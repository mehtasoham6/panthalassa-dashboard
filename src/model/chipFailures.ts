import { CONST } from "./constants.js";
import type { ChipFailureResult, DerivedQuantities, ModelInputs } from "./types.js";
import {
  outboundLegSegments,
  outboundLegSegmentsPartial,
  returnLegSegments,
  processSegments,
  type BatteryState,
  type LegSegment,
} from "./energy.js";

/**
 * Unified compute-health and service-schedule engine. This module now owns
 * the entire journey/battery walk (outbound, sea-park, return, dock) --
 * there is no more separate "no-failure baseline" calendar, since the
 * service schedule itself depends on chip degradation.
 *
 * Governing model:
 *  1. Compute health decays continuously from the moment of each
 *     restoration: healthyCapacityKw(age) = P * exp(-lambda*age). No block
 *     granularity -- both guaranteed and best-effort/hot-spare capacity
 *     count toward delivered output while healthy, and degrade together.
 *  2. A surprise service trip departs once healthy capacity first reaches
 *     the guaranteed share, P*(1-h): triggerAgeYears = -ln(1-h)/lambda
 *     (Infinity if lambda=0 -- no chip-triggered surprise service).
 *  3. Fixed full-node maintenance is nominally anchored at years 5, 10, 15,
 *     ..., independent of the trigger, but that date isn't rigid: after
 *     every restoration, whichever of {hot-spare-exhaustion date, next fixed
 *     -maintenance date} comes first governs; if a standalone surprise
 *     payload-service visit would complete within
 *     `CONST.maintenance_consolidation_window_years` (6 months) before the
 *     next fixed-maintenance date -- or at/after it -- the two consolidate
 *     into one combined 7-day visit, and the 5-year clock then resets from
 *     that actual combined-service date, not the superseded calendar date.
 *     A surprise trip more than 6 months out is never delayed to wait for
 *     the later maintenance date; it stays a standalone 1-day visit and the
 *     planned maintenance date is untouched.
 *  4. At every visit (surprise or fixed), only the capacity that has
 *     actually failed by service time is replaced: P*(1-exp(-lambda*age)).
 *     Health is always fully restored to P; there is no partial/carried
 *     replacement policy.
 *  5. Delivered power at any instant during ROUTE travel (tug/self-propulsion
 *     legs) is min(healthyCapacityKw, power available after the existing
 *     wave/PTO/battery system) -- see `creditRampSegment` below. Since the
 *     PTO is always sized above the payload, the equipment cap equals P
 *     exactly, so compute health binds immediately (for any age>0) whenever
 *     the wave resource alone would otherwise hit the cap; during
 *     wave-limited (gap) time, wave power governs unless degradation has
 *     become severe enough to fall below it too.
 *  5b. At SEA PARK, delivered power is healthyCapacityKw(age) *
 *     effective_sea_park_cf -- a historical-WAVERYS-derived capacity factor
 *     (see waverys.ts and `creditSeaPark` below) applied as a constant
 *     multiplicative derate on the health curve, rather than re-solving a
 *     health-vs-instantaneous-wave crossover against the full 3-hourly
 *     record at every point on the curve. This is intentionally slightly
 *     conservative: as healthy compute declines, the same wave resource
 *     would in reality find it marginally easier to power the (smaller)
 *     remaining load, which this simplification does not credit.
 *  6. The battery starts every port departure -- initial deployment and
 *     every redeployment after dockside service -- fully charged. SOC then
 *     carries chronologically stage to stage until the next departure; it
 *     is never reset mid-cycle. This lets a full battery cover part of the
 *     weak-wave shortfall during the initial outbound ramp. This chronological
 *     per-node battery only ever interacts with ROUTE legs -- the sea-park
 *     stage's own (separate, config-level, episode-based) battery smoothing
 *     approximation is already folded into effective_sea_park_cf.
 *
 * Boundary conventions (see the accompanying report): a trigger age shorter
 * than the outbound travel time is clamped to "surprise departure no
 * earlier than arrival at sea park" (the model has no notion of reversing
 * mid-transit). The health-vs-wave crossover is solved exactly (closed
 * form) for the sea-park segment, since it can now span years; for the
 * short (<=~30 day) outbound/return ramp legs, a whole-segment
 * healthy-vs-wave comparison is used instead of solving a mid-ramp
 * crossing, since the possible error is bounded by at most a few percent
 * of a single leg's energy against multi-year cycle totals.
 */

interface CapParams {
  capture_coefficient: number;
  power_cap_kw: number;
  full_output_flux_kw_per_m: number;
}

interface Totals {
  chipAdjustedEnergyKwh: number;
  surpriseServiceEvents: number;
  maintenanceEvents: number;
  failedCapacityKwReplaced: number;
  physicalTugRoundTrips: number;
  yearlyDeliveredEnergyKwh: number[];
  yearlyFailedCapacityKwReplaced: number[];
  yearlySurpriseEvents: number[];
  yearlyScheduledFullMaintenanceEvents: number[];
  yearlyTugRoundTrips: number[];
}

function makeTotals(years: number): Totals {
  return {
    chipAdjustedEnergyKwh: 0,
    surpriseServiceEvents: 0,
    maintenanceEvents: 0,
    failedCapacityKwReplaced: 0,
    physicalTugRoundTrips: 0,
    yearlyDeliveredEnergyKwh: new Array(years).fill(0),
    yearlyFailedCapacityKwReplaced: new Array(years).fill(0),
    yearlySurpriseEvents: new Array(years).fill(0),
    yearlyScheduledFullMaintenanceEvents: new Array(years).fill(0),
    yearlyTugRoundTrips: new Array(years).fill(0),
  };
}

function yearIndexFor(absoluteTime: number, Tend: number): number {
  const idx = Math.ceil(absoluteTime - 1e-9) - 1;
  return Math.max(0, Math.min(idx, Tend - 1));
}

/** Closed-form healthy compute energy over age range [a,b]: integral of hours_per_year*P*exp(-lambda*age) da. */
function degradationHealthyEnergy(a: number, b: number, P: number, lambda: number): number {
  if (b <= a) return 0;
  if (lambda === 0) return CONST.hours_per_year * P * (b - a);
  return ((CONST.hours_per_year * P) / lambda) * (Math.exp(-lambda * a) - Math.exp(-lambda * b));
}

/** Walks [absStart,absEnd) in calendar-year chunks, invoking fn(chunkAbsStart, chunkAbsEnd, yearIndex) for each. */
function forEachYearChunk(absStart: number, absEnd: number, Tend: number, fn: (a: number, b: number, yi: number) => void): void {
  let cur = absStart;
  while (cur < absEnd - 1e-9) {
    const nextBoundary = Math.floor(cur + 1e-9) + 1;
    const chunkEnd = Math.min(absEnd, nextBoundary);
    fn(cur, chunkEnd, yearIndexFor(chunkEnd, Tend));
    cur = chunkEnd;
  }
}

/**
 * Credits a short (ramp) segment -- outbound or return leg sub-segments --
 * applying a whole-segment healthy-vs-wave comparison (no mid-segment
 * split; see module docs). Advances and returns the new age. Battery only
 * interacts when the segment's own (health-blind) wave/cap behavior
 * governs.
 */
function creditRampSegment(
  seg: LegSegment,
  age: number,
  absTime: number,
  battery: BatteryState,
  batteryCapacityKwh: number,
  P: number,
  lambda: number,
  totals: Totals,
  Tend: number,
): { age: number; absTime: number } {
  const ageEnd = age + seg.days / 365;
  const absEnd = absTime + seg.days / 365;

  let delivered: number;
  if (lambda === 0) {
    delivered = processSegments([seg], battery, batteryCapacityKwh).deliveredEnergyKwh;
  } else {
    const healthyKwh = degradationHealthyEnergy(age, ageEnd, P, lambda);
    if (seg.kind === "atcap") {
      // Health always binds for age>0 (equipment cap == P). Battery still
      // charges from the wave surplus above cap -- that surplus exists
      // regardless of compute health.
      const charge = Math.min(seg.potentialKwh, batteryCapacityKwh - battery.socKwh);
      battery.socKwh += charge;
      delivered = healthyKwh;
    } else if (healthyKwh < seg.deliveredEnergyKwh) {
      // Degraded enough that compute health governs this whole (short) gap segment.
      delivered = healthyKwh;
    } else {
      delivered = processSegments([seg], battery, batteryCapacityKwh).deliveredEnergyKwh;
    }
  }

  totals.chipAdjustedEnergyKwh += delivered;
  totals.yearlyDeliveredEnergyKwh[yearIndexFor(absEnd, Tend)]! += delivered;
  return { age: ageEnd, absTime: absEnd };
}

/** Credits an ordered list of ramp segments (outbound or return leg), returning the ending age/time. */
function creditRampSegments(
  segments: LegSegment[],
  age: number,
  absTime: number,
  battery: BatteryState,
  batteryCapacityKwh: number,
  P: number,
  lambda: number,
  totals: Totals,
  Tend: number,
): { age: number; absTime: number } {
  let a = age;
  let t = absTime;
  for (const seg of segments) {
    const r = creditRampSegment(seg, a, t, battery, batteryCapacityKwh, P, lambda, totals, Tend);
    a = r.age;
    t = r.absTime;
  }
  return { age: a, absTime: t };
}

/**
 * Credits a (potentially multi-year) sea-park stretch. Delivered power is
 * healthyCapacityKw(age) * effectiveSeaParkCF -- the historical-WAVERYS
 * capacity factor (raw wave-resource CF plus the episode-level battery
 * recovery approximation, see waverys.ts) applied as a constant derate on
 * the closed-form health-decay integral, split across calendar years for
 * correct cost/PV timing. No wave-vs-health crossover solve and no
 * chronological-battery interaction here: the sea-park resource correction
 * is a separate, config-level effect already folded into effectiveSeaParkCF
 * (see module docs, point 5b) -- the per-node route battery is untouched.
 */
function creditSeaPark(
  seaParkDays: number,
  age: number,
  absTime: number,
  P: number,
  lambda: number,
  effectiveSeaParkCF: number,
  totals: Totals,
  Tend: number,
): { age: number; absTime: number } {
  if (seaParkDays <= 0) return { age, absTime };
  const ageEnd = age + seaParkDays / 365;
  const absEnd = absTime + seaParkDays / 365;

  forEachYearChunk(absTime, absEnd, Tend, (a, b, yi) => {
    const chunkAgeA = age + (a - absTime);
    const chunkAgeB = age + (b - absTime);
    const kwh = degradationHealthyEnergy(chunkAgeA, chunkAgeB, P, lambda) * effectiveSeaParkCF;
    totals.chipAdjustedEnergyKwh += kwh;
    totals.yearlyDeliveredEnergyKwh[yi]! += kwh;
  });

  return { age: ageEnd, absTime: absEnd };
}

function creditServiceEvent(failedKw: number, completionAbs: number, totals: Totals, Tend: number): void {
  totals.failedCapacityKwReplaced += failedKw;
  totals.yearlyFailedCapacityKwReplaced[yearIndexFor(completionAbs, Tend)]! += failedKw;
}

export function computeChipFailures(inputs: ModelInputs, derived: DerivedQuantities): ChipFailureResult {
  const P = inputs.payload_rating_kw;
  const h = inputs.hotSpareShare;
  const lambda = inputs.chip_failure_rate_annual;
  const Tend = inputs.analysis_period_years;
  const capParams: CapParams = {
    capture_coefficient: derived.capture_coefficient,
    power_cap_kw: derived.power_cap_kw,
    full_output_flux_kw_per_m: derived.full_output_flux_kw_per_m,
  };
  const legInputs = {
    ...capParams,
    one_way_tug_days: derived.one_way_tug_days,
    one_way_self_propulsion_days: derived.one_way_self_propulsion_days,
  };
  const outboundDays = derived.outbound_days;
  const returnYears = derived.one_way_journey_days / CONST.days_per_year;
  const arrivalLocal = outboundDays / CONST.days_per_year;
  const payloadDockYears = CONST.payload_swap_dock_days / CONST.days_per_year;
  const maintenanceDockYears = CONST.node_maintenance_dock_days / CONST.days_per_year;
  const batteryCapacityKwh = P * inputs.battery_duration_hours;
  // Reset to full at the top of every loop iteration (every port departure) below.
  const battery: BatteryState = { socKwh: batteryCapacityKwh };
  const effectiveSeaParkCF = derived.effective_sea_park_cf;

  // Fixed shape (durations, capped/wave energy per segment) is the same every occurrence.
  const outboundSegments = outboundLegSegments(legInputs);
  const returnSegments = returnLegSegments(legInputs);

  const triggerAgeYears = lambda > 0 ? -Math.log(1 - h) / lambda : Infinity;

  const totals = makeTotals(Tend);
  let s = 0; // absolute time, dock-departure (fresh, fully-healthy payload)
  let nextMaintenanceTime = CONST.node_maintenance_interval_years;

  for (let iterations = 0; iterations < 10_000; iterations++) {
    if (s >= Tend - 1e-12) break;

    // Every departure from port -- initial deployment and every redeployment
    // after dockside service -- starts with a fully charged battery.
    battery.socKwh = batteryCapacityKwh;

    // Outbound leg, truncated at the analysis horizon if it would run past it.
    const daysUntilTend = (Tend - s) * CONST.days_per_year;
    if (daysUntilTend < outboundDays) {
      creditRampSegments(outboundLegSegmentsPartial(legInputs, daysUntilTend), 0, s, battery, batteryCapacityKwh, P, lambda, totals, Tend);
      break;
    }

    const outboundResult = creditRampSegments(outboundSegments, 0, s, battery, batteryCapacityKwh, P, lambda, totals, Tend);
    const arrivalAbs = outboundResult.absTime; // == s + arrivalLocal
    if (arrivalAbs >= Tend - 1e-9) break;

    // Earliest a surprise return can depart: the trigger age, but never before arrival at sea park
    // (the model has no notion of reversing mid-outbound-transit -- see module docs).
    const triggerDepartAbs = Math.max(s + triggerAgeYears, arrivalAbs);
    // The trigger date itself must also fall within the horizon -- otherwise
    // (now that nextMaintenanceTime can be pushed out past Tend by a
    // consolidation) the surprise-cycle branch below would credit sea-park
    // and return energy for calendar time beyond the analysis period before
    // its own horizon check ever ran. When the trigger is beyond Tend, fall
    // through to the fixed-maintenance-only path, whose horizon clamp
    // already handles "just keep operating through the end" correctly.
    const surpriseWillHappen = triggerDepartAbs < nextMaintenanceTime - 1e-9 && triggerDepartAbs < Tend - 1e-9;

    if (!surpriseWillHappen) {
      // Fixed-maintenance-only cycle.
      if (nextMaintenanceTime >= Tend - 1e-9) {
        // Maintenance would complete at/after the horizon: excluded (boundary rule).
        // The return trip is never launched; the node just operates at sea park through the horizon.
        const seaParkDays = Math.max(0, (Tend - arrivalAbs) * CONST.days_per_year);
        creditSeaPark(seaParkDays, arrivalLocal, arrivalAbs, P, lambda, effectiveSeaParkCF, totals, Tend);
        break;
      }

      const dockYears = maintenanceDockYears;
      const returnStartAbs = nextMaintenanceTime - returnYears - dockYears;
      const seaParkDays = Math.max(0, (returnStartAbs - arrivalAbs) * CONST.days_per_year);
      const seaPark = creditSeaPark(seaParkDays, arrivalLocal, arrivalAbs, P, lambda, effectiveSeaParkCF, totals, Tend);

      if (returnStartAbs < arrivalAbs - 1e-9) {
        // Degenerate: no runway to sea-park before the return must begin. Stop rather than loop.
        break;
      }

      const returnResult = creditRampSegments(returnSegments, seaPark.age, seaPark.absTime, battery, batteryCapacityKwh, P, lambda, totals, Tend);
      const ageAtService = returnResult.age;
      const completionAbs = nextMaintenanceTime;

      const failedKw = P * (1 - Math.exp(-lambda * ageAtService));
      creditServiceEvent(failedKw, completionAbs, totals, Tend);
      totals.maintenanceEvents += 1;
      totals.yearlyScheduledFullMaintenanceEvents[yearIndexFor(completionAbs, Tend)]! += 1;
      totals.physicalTugRoundTrips += 1;
      totals.yearlyTugRoundTrips[yearIndexFor(completionAbs, Tend)]! += 1;

      nextMaintenanceTime += CONST.node_maintenance_interval_years;
      s = completionAbs;
      continue;
    }

    // Surprise-triggered cycle, consolidated with fixed maintenance if the
    // standalone payload-only visit would complete within the consolidation
    // window before the next fixed-maintenance date (or at/after it).
    const ordinaryCompletion = triggerDepartAbs + returnYears + payloadDockYears;
    const isCombined =
      nextMaintenanceTime - ordinaryCompletion <= CONST.maintenance_consolidation_window_years + 1e-9;
    const dockYears = isCombined ? maintenanceDockYears : payloadDockYears;

    const seaParkDays = Math.max(0, (triggerDepartAbs - arrivalAbs) * CONST.days_per_year);
    const seaPark = creditSeaPark(seaParkDays, arrivalLocal, arrivalAbs, P, lambda, effectiveSeaParkCF, totals, Tend);

    const returnResult = creditRampSegments(returnSegments, seaPark.age, seaPark.absTime, battery, batteryCapacityKwh, P, lambda, totals, Tend);
    const ageAtService = returnResult.age;
    const completionAbs = seaPark.absTime + returnYears + dockYears;

    if (completionAbs >= Tend - 1e-9) {
      // Trip launched (and its degraded travel output already credited above), but doesn't
      // complete within the horizon: no redeploy, no replacement event credited.
      break;
    }

    const failedKw = P * (1 - Math.exp(-lambda * ageAtService));
    creditServiceEvent(failedKw, completionAbs, totals, Tend);
    totals.surpriseServiceEvents += 1;
    totals.yearlySurpriseEvents[yearIndexFor(completionAbs, Tend)]! += 1;
    totals.physicalTugRoundTrips += 1;
    totals.yearlyTugRoundTrips[yearIndexFor(completionAbs, Tend)]! += 1;
    if (isCombined) {
      totals.maintenanceEvents += 1;
      totals.yearlyScheduledFullMaintenanceEvents[yearIndexFor(completionAbs, Tend)]! += 1;
      // Reset the 5-year clock from the actual combined service date, not
      // the superseded calendar date it replaced.
      nextMaintenanceTime = completionAbs + CONST.node_maintenance_interval_years;
    }

    s = completionAbs;
  }

  return {
    chip_adjusted_energy_kwh: totals.chipAdjustedEnergyKwh,
    expected_mode_1_surprise_service_event_count_per_position: totals.surpriseServiceEvents,
    scheduled_node_maintenance_event_count_per_position: totals.maintenanceEvents,
    expected_failed_capacity_kw_replaced_per_position: totals.failedCapacityKwReplaced,
    expected_mode_1_physical_tug_round_trips_per_position: totals.physicalTugRoundTrips,
    yearly_delivered_energy_kwh: totals.yearlyDeliveredEnergyKwh,
    yearly_failed_capacity_kw_replaced: totals.yearlyFailedCapacityKwReplaced,
    yearly_surprise_service_events: totals.yearlySurpriseEvents,
    yearly_scheduled_full_maintenance_events: totals.yearlyScheduledFullMaintenanceEvents,
    yearly_mode_1_tug_round_trips: totals.yearlyTugRoundTrips,
  };
}
