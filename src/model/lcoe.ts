import { CONST } from "./constants.js";
import type { DerivedQuantities, LcoeResult, ModelInputs } from "./types.js";
import {
  outboundLegSegments,
  outboundLegSegmentsPartial,
  returnLegSegments,
  processSegments,
  type BatteryState,
  type LegSegment,
} from "./energy.js";
import { computeNodeUnitCosts } from "./nodeUnitCosts.js";
import { remainingLifeIntegral } from "./remainingLife.js";

/**
 * Power-system LCOE: a standalone, compute-agnostic levelized cost of
 * electricity for the node's non-compute power-generating platform,
 * evaluated over one full generating-asset economic life
 * (node_lifetime_years) for a single representative position -- independent
 * of the dashboard's general analysis-period/target-fleet-capacity sliders
 * and of everything chip-health-related (degradation, hot spares, surprise
 * service, payload-only dock time, the six-month maintenance-consolidation
 * rule). This is a parallel calculation, not a replacement for total
 * lifecycle cost (costs.ts/presentValue.ts) or fleet sizing (fleet.ts),
 * which remain fully compute-aware and unchanged.
 *
 * Physical/resource logic -- route wave ramps, the Copernicus WAVERYS
 * sea-park capacity factor plus its episode-level battery-recovery bump,
 * deterministic route-level battery behavior, and the rated electrical cap
 * -- is intentionally identical to the integrated model's, since none of it
 * is compute-specific: it already lives in derived.ts and is reused as-is
 * here. What is deliberately NOT reused is chipFailures.ts's schedule walk:
 * this module runs its own lightweight physical-maintenance-only schedule
 * (nominal five-year cadence, never moved earlier to combine with a
 * compute-service trip) so that changes to compute-hardware economics or
 * the chip-degradation model can never silently change LCOE.
 *
 * Included: initial non-compute capital (t=0); periodic physical
 * maintenance (labor + its round-trip tug cost); Modes 2/3 (non-chip
 * whole-node failures -- energy downtime plus repair/tug cost); Modes 4/5
 * (total loss -- non-compute-only replacement cost, remaining-economic-life
 * weighted exactly as in the integrated model, plus Mode 5's cleanup cost
 * and the replacement's deployment tug cost); retirement, charged at the
 * end of this one economic life (t = node_lifetime_years).
 *
 * Excluded: chip degradation/hazard/hot-spare logic entirely; compute
 * hardware capex; failed-chip replacement cost; workload data-transfer
 * cost; any event whose timing depends on compute-service state.
 */

interface CapParams {
  capture_coefficient: number;
  power_cap_kw: number;
  full_output_flux_kw_per_m: number;
}

function yearIndexFor(absoluteTime: number, Tend: number): number {
  const idx = Math.ceil(absoluteTime - 1e-9) - 1;
  return Math.max(0, Math.min(idx, Tend - 1));
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

/** Credits a route leg's segments (tug/self-propulsion ramps) into yearly energy buckets -- pure wave/PTO/battery physics, no compute health. */
function creditRouteSegments(
  segments: LegSegment[],
  absTime: number,
  battery: BatteryState,
  batteryCapacityKwh: number,
  yearlyEnergyKwh: number[],
  Tend: number,
): number {
  let t = absTime;
  for (const seg of segments) {
    const r = processSegments([seg], battery, batteryCapacityKwh);
    const absEnd = t + seg.days / 365;
    yearlyEnergyKwh[yearIndexFor(absEnd, Tend)]! += r.deliveredEnergyKwh;
    t = absEnd;
  }
  return t;
}

/** Credits a (potentially multi-year) sea-park stretch at the constant rated cap x the WAVERYS-derived effective factor -- no chip-health crossover to solve. */
function creditSeaParkPowerOnly(
  seaParkDays: number,
  absTime: number,
  powerCapKw: number,
  effectiveSeaParkCF: number,
  yearlyEnergyKwh: number[],
  Tend: number,
): number {
  if (seaParkDays <= 0) return absTime;
  const absEnd = absTime + seaParkDays / 365;
  forEachYearChunk(absTime, absEnd, Tend, (a, b, yi) => {
    const hours = (b - a) * 365 * 24;
    yearlyEnergyKwh[yi]! += powerCapKw * hours * effectiveSeaParkCF;
  });
  return absEnd;
}

export function computeLcoe(inputs: ModelInputs, derived: DerivedQuantities): LcoeResult {
  const Tend = inputs.node_lifetime_years; // LCOE horizon: one generating-asset economic life, not the analysis period
  const unit = computeNodeUnitCosts(inputs, derived);

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
  const maintenanceDockYears = CONST.node_maintenance_dock_days / CONST.days_per_year;
  const batteryCapacityKwh = inputs.payload_rating_kw * inputs.battery_duration_hours;
  const tugLegCostUsd = CONST.tug_cost_usd_per_day * derived.one_way_tug_days;

  const outboundSegments = outboundLegSegments(legInputs);
  const returnSegments = returnLegSegments(legInputs);
  const battery: BatteryState = { socKwh: batteryCapacityKwh };

  // Schedule-convention arrays: index i => "completed year i+1" (calendar
  // time in (i, i+1]), matching chipFailures.ts's yearly_* convention --
  // mapped into the final t=0..Tend present-value arrays below.
  const scheduleEnergyKwh: number[] = new Array(Tend).fill(0);
  const scheduleCostUsd: number[] = new Array(Tend).fill(0);

  // Chronological walk of fixed-interval PHYSICAL maintenance only -- no
  // chip-triggered surprise service, no six-month consolidation. This is the
  // one deliberate divergence from chipFailures.ts's schedule.
  let s = 0;
  let nextMaintenanceTime = CONST.node_maintenance_interval_years;
  for (let iterations = 0; iterations < 10_000; iterations++) {
    if (s >= Tend - 1e-12) break;

    battery.socKwh = batteryCapacityKwh; // fully charged at every departure, same rule as the integrated model

    const daysUntilTend = (Tend - s) * CONST.days_per_year;
    if (daysUntilTend < outboundDays) {
      creditRouteSegments(outboundLegSegmentsPartial(legInputs, daysUntilTend), s, battery, batteryCapacityKwh, scheduleEnergyKwh, Tend);
      break;
    }

    const arrivalAbs = creditRouteSegments(outboundSegments, s, battery, batteryCapacityKwh, scheduleEnergyKwh, Tend);
    if (arrivalAbs >= Tend - 1e-9) break;

    if (nextMaintenanceTime >= Tend - 1e-9) {
      // Boundary rule (mirrors the integrated model): a maintenance visit
      // completing at/after the horizon doesn't happen -- the node just
      // operates at sea park through the end of its economic life.
      const seaParkDays = Math.max(0, (Tend - arrivalAbs) * CONST.days_per_year);
      creditSeaParkPowerOnly(seaParkDays, arrivalAbs, derived.power_cap_kw, derived.effective_sea_park_cf, scheduleEnergyKwh, Tend);
      break;
    }

    const returnStartAbs = nextMaintenanceTime - returnYears - maintenanceDockYears;
    const seaParkDays = Math.max(0, (returnStartAbs - arrivalAbs) * CONST.days_per_year);
    const seaParkEndAbs = creditSeaParkPowerOnly(
      seaParkDays,
      arrivalAbs,
      derived.power_cap_kw,
      derived.effective_sea_park_cf,
      scheduleEnergyKwh,
      Tend,
    );

    if (returnStartAbs < arrivalAbs - 1e-9) break; // degenerate: no runway before the return must begin

    creditRouteSegments(returnSegments, seaParkEndAbs, battery, batteryCapacityKwh, scheduleEnergyKwh, Tend);
    const completionAbs = nextMaintenanceTime;

    const yi = yearIndexFor(completionAbs, Tend);
    scheduleCostUsd[yi]! += CONST.scheduled_node_maintenance_cost_fraction * unit.non_compute_node_cost_usd;
    scheduleCostUsd[yi]! += 2 * tugLegCostUsd; // one round trip for this maintenance cycle

    nextMaintenanceTime += CONST.node_maintenance_interval_years;
    s = completionAbs;
  }

  // Modes 2-5: physical (non-chip) whole-node failures, expected-value,
  // spread pro-rata across years 1..Tend (constant-rate exposure) -- same
  // methodology as the integrated model's Modes 2-5 treatment (see
  // nodeFailureModes.ts / presentValue.ts), evaluated over the LCOE horizon
  // (node life) for one node instead of the fleet-wide analysis period.
  const mode_2_rate_annual = inputs.node_failure_rate_annual * CONST.mode_2_weight;
  const mode_3_rate_annual = inputs.node_failure_rate_annual * CONST.mode_3_weight;
  const mode_4_rate_annual = inputs.node_failure_rate_annual * CONST.mode_4_weight;
  const mode_5_rate_annual = inputs.node_failure_rate_annual * CONST.mode_5_weight;

  const outboundEnergyKwh = derived.outbound_energy_kwh;
  const returnDays = derived.one_way_journey_days;
  const powerCapKw = derived.power_cap_kw;
  // Modes 2/3's lost-time counterfactual is resource-adjusted (same as the
  // integrated model); Modes 4/5 keep the existing unadjusted deployment-ramp
  // treatment (no sea-park-time component in that formula).
  const seaParkAdjustedCapKw = powerCapKw * derived.effective_sea_park_cf;

  const mode_2_loss_per_event_kwh =
    24 * seaParkAdjustedCapKw * (returnDays + CONST.mode_2_repair_days + outboundDays) - outboundEnergyKwh;
  const tugDispatchDays = inputs.sea_park_distance_km / CONST.tug_speed_km_per_day;
  const towBackDays = tugDispatchDays;
  const mode_3_loss_per_event_kwh =
    24 * seaParkAdjustedCapKw * (tugDispatchDays + towBackDays + CONST.mode_3_repair_days + outboundDays) - outboundEnergyKwh;
  const mode_4_loss_per_event_kwh = 24 * powerCapKw * outboundDays - outboundEnergyKwh;
  const mode_5_loss_per_event_kwh = mode_4_loss_per_event_kwh;

  const totalModeLossKwh =
    Tend * mode_2_rate_annual * mode_2_loss_per_event_kwh +
    Tend * mode_3_rate_annual * mode_3_loss_per_event_kwh +
    Tend * mode_4_rate_annual * mode_4_loss_per_event_kwh +
    Tend * mode_5_rate_annual * mode_5_loss_per_event_kwh;
  const modeLossPerYearKwh = totalModeLossKwh / Tend;
  for (let i = 0; i < Tend; i++) scheduleEnergyKwh[i]! -= modeLossPerYearKwh;

  // Modes 2/3 tug + mechanical-repair cost, Mode 4/5 replacement-deployment
  // tug cost, and Mode 5 cleanup: uniform annual-rate costs, unrelated to
  // node age -- mirrors costs.ts's non-remaining-life-weighted line items.
  const mode_2_tug_cost_per_year = 2 * tugLegCostUsd * mode_2_rate_annual;
  const mode_3_tug_cost_per_year =
    mode_3_rate_annual *
    CONST.tug_cost_usd_per_day *
    ((2 * inputs.sea_park_distance_km) / CONST.tug_speed_km_per_day + derived.one_way_tug_days);
  const replacement_deployment_tug_cost_per_year = (mode_4_rate_annual + mode_5_rate_annual) * tugLegCostUsd;
  const mechanical_repair_cost_per_year =
    CONST.disabling_mechanical_repair_cost_usd * (mode_2_rate_annual + mode_3_rate_annual);
  const mode_5_cleanup_cost_per_year = CONST.mode_5_catastrophic_cost_usd * mode_5_rate_annual;

  const uniformCostPerYear =
    mode_2_tug_cost_per_year +
    mode_3_tug_cost_per_year +
    replacement_deployment_tug_cost_per_year +
    mechanical_repair_cost_per_year +
    mode_5_cleanup_cost_per_year;

  // Mode 4/5 physical-platform replacement cost: remaining-economic-life
  // weighted (same closed-form integral as the integrated model), but using
  // ONLY the non-compute node cost -- never the compute payload (that would
  // reintroduce a compute-hardware cost into LCOE).
  const totalLossRatePerYear = mode_4_rate_annual + mode_5_rate_annual;
  for (let y = 1; y <= Tend; y++) {
    scheduleCostUsd[y - 1]! += uniformCostPerYear;
    const yearRemainingLifeIntegral = remainingLifeIntegral(y - 1, y, inputs.node_lifetime_years);
    scheduleCostUsd[y - 1]! += totalLossRatePerYear * unit.non_compute_node_cost_usd * yearRemainingLifeIntegral;
  }

  // Map into the final t=0..Tend present-value arrays: initial capital at
  // t=0, retirement at t=Tend (end of this one economic life), everything
  // else at its completed-year bucket.
  const numBuckets = Tend + 1;
  const yearlyCostUsd: number[] = new Array(numBuckets).fill(0);
  const yearlyEnergyKwh: number[] = new Array(numBuckets).fill(0);

  yearlyCostUsd[0] = unit.non_compute_node_cost_usd;
  for (let y = 1; y <= Tend; y++) {
    yearlyCostUsd[y]! += scheduleCostUsd[y - 1]!;
    yearlyEnergyKwh[y]! += scheduleEnergyKwh[y - 1]!;
  }
  yearlyCostUsd[Tend]! += CONST.node_retirement_processing_cost_fraction * unit.non_compute_node_cost_usd;

  const r = inputs.real_discount_rate;
  let presentValueCostUsd = 0;
  let presentValueEnergyKwh = 0;
  for (let t = 0; t < numBuckets; t++) {
    const factor = Math.pow(1 + r, t);
    presentValueCostUsd += yearlyCostUsd[t]! / factor;
    presentValueEnergyKwh += yearlyEnergyKwh[t]! / factor;
  }
  const presentValueEnergyMwh = presentValueEnergyKwh / 1_000;

  return {
    lcoe_usd_per_mwh: presentValueCostUsd / presentValueEnergyMwh,
    lcoe_horizon_years: Tend,
    present_value_power_system_cost_usd: presentValueCostUsd,
    present_value_electrical_energy_mwh: presentValueEnergyMwh,
    yearly_power_system_cost_usd: yearlyCostUsd,
    yearly_electrical_energy_kwh: yearlyEnergyKwh,
  };
}
