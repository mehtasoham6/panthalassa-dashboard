import { CONST } from "./constants.js";
import waverysData from "./data/waverysSeaPark.json";

/**
 * Copernicus Marine WAVERYS wave-resource model for the sea-park stage
 * (Section 3.1/3.2 extension).
 *
 * Data: GLOBAL_MULTIYEAR_WAV_001_032, cmems_mod_glo_wav_my_0.2deg_PT3H-i,
 * representative sea-park point ~53.6S, 133.6E (high-resource Southern Ocean
 * south of Australia), 1980-2025, 3-hourly VHM0 (significant wave height, m)
 * and VTM10 (mean wave period, s). Preprocessed once (scripts/
 * preprocess_waverys.py) into src/model/data/waverysSeaPark.json -- no
 * NetCDF parsing happens at runtime; this module only ever reads that
 * already-converted, already-filtered flux series.
 *
 * The sea-park location is fixed (not a slider): only sliders that change
 * wave capture (hull diameter, end-to-end efficiency) or load (payload,
 * PTO cap) move the outputs below.
 *
 * This module deliberately exposes TWO independent families of calculation
 * that must not be conflated:
 *
 *  1. rawWaveResourceCF / seaParkBatteryRecoveryFraction / effectiveSeaParkCF
 *     -- the original energy-average formula. effectiveSeaParkCF is what
 *     chipFailures.ts / lcoe.ts / nodeFailureModes.ts actually multiply
 *     against healthy compute capacity to schedule sea-park energy, and
 *     therefore what drives fleet sizing and lifecycle cost. This is
 *     unchanged model logic -- battery duration affects it exactly as it
 *     always has.
 *  2. computeResourceCapacityFactor / computeRatedPowerAvailability /
 *     computeKeepaliveAvailability -- three purely descriptive dashboard
 *     metrics (see below). None of them feed energy delivery, fleet sizing,
 *     or cost anywhere -- see derived.ts.
 *
 * The three descriptive metrics:
 *  - Resource capacity factor: useful compute work actually available,
 *    relative to a theoretically perfect continuous-full-power environment.
 *    "Useful work" is server power above the fixed idle-power floor
 *    (CONST.server_idle_power_fraction of rated payload) -- a server merely
 *    idling isn't doing useful compute work, so that floor is subtracted
 *    before anything counts. This is a genuine energy-average capacity
 *    factor (partial credit for partial power), NOT a share-of-time metric.
 *  - Rated power availability: share of historical time the full payload
 *    can run at 100% (no partial credit at all) -- what most people mean by
 *    "capacity factor" colloquially, but that term is reserved for the
 *    metric above here, so this is named for what it actually measures.
 *  - Keepalive availability: share of historical time there's at least
 *    enough power to keep the servers powered at idle, even if not enough
 *    to do useful work.
 * All three share the same lull-by-lull battery approximation (assume full
 * charge at the start of every historical lull; no chronological
 * state-of-charge simulation), applied independently per metric -- there is
 * no joint battery-dispatch optimization across the three.
 */

interface WaverysDataFile {
  latitude: number;
  longitude: number;
  periodStart: string;
  periodEnd: string;
  intervalHours: number;
  observationCount: number;
  excludedInvalidCount: number;
  meanFluxKwPerM: number;
  fluxKwPerM: number[];
}

const data = waverysData as WaverysDataFile;

export const WAVERYS_META = {
  latitude: data.latitude,
  longitude: data.longitude,
  periodStart: data.periodStart,
  periodEnd: data.periodEnd,
  intervalHours: data.intervalHours,
  observationCount: data.observationCount,
  excludedInvalidCount: data.excludedInvalidCount,
  meanFluxKwPerM: data.meanFluxKwPerM,
} as const;

/**
 * Incident deep-water wave-energy flux from significant wave height (Hs, m)
 * and mean wave period (Te, s): 0.49 * Hs^2 * Te (kW/m). Returns null (drop
 * the observation) if either input is missing/non-finite.
 */
export function computeWaveFluxKwPerM(significantWaveHeightM: number, meanWavePeriodS: number): number | null {
  if (!Number.isFinite(significantWaveHeightM) || !Number.isFinite(meanWavePeriodS)) return null;
  return 0.49 * significantWaveHeightM * significantWaveHeightM * meanWavePeriodS;
}

// Preprocessed once per process (not per slider move): the chronological
// series is loaded a single time at module load. Needed in chronological
// order (not sorted) for both the energy-average CF's episode scan and the
// descriptive metrics' lull scans, since lull/episode length and severity
// depend on run structure, not just the marginal flux distribution.
const fluxChronological: Float64Array = Float64Array.from(data.fluxKwPerM);

const sortedFlux: Float64Array = Float64Array.from(fluxChronological).sort();
const N = sortedFlux.length;
/** prefixSum[i] = sum of sortedFlux[0..i-1]. */
const prefixSum: Float64Array = new Float64Array(N + 1);
for (let i = 0; i < N; i++) prefixSum[i + 1] = prefixSum[i]! + sortedFlux[i]!;

/** First index i such that sortedFlux[i] >= threshold. */
function lowerBoundIndex(threshold: number): number {
  let lo = 0;
  let hi = N;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedFlux[mid]! < threshold) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface SeaParkResourceParams {
  /** hullDiameter * CWR(hullDiameter) * end-to-end efficiency -- kW of captured power per kW/m of flux. */
  captureCoefficient: number;
  /** min(payload, PTO) equipment cap -- equals payloadRatingKw by construction (PTO is always sized above payload). */
  powerCapKw: number;
  /** Installed compute-payload cap -- the energy-average CF's denominator (rawWaveResourceCF/effectiveSeaParkCF only). */
  payloadRatingKw: number;
}

/**
 * Raw wave-resource capacity factor (energy average):
 *   mean(min(captureCoefficient * flux, powerCapKw)) / payloadRatingKw
 * over the full historical WAVERYS flux distribution at the representative
 * sea-park point. Order-independent (a sorted-distribution statistic), so it
 * is computed via a one-time sort + prefix sum rather than a per-call linear
 * scan: O(log N) per call. Does NOT depend on battery duration. Feeds
 * effectiveSeaParkCF, which drives energy delivery -- see module docs.
 */
export function rawWaveResourceCF(params: SeaParkResourceParams): number {
  const { captureCoefficient, powerCapKw, payloadRatingKw } = params;
  const thresholdFlux = powerCapKw / captureCoefficient;
  const k = lowerBoundIndex(thresholdFlux); // sortedFlux[0..k) below cap, [k..N) at/above cap
  const sumKw = captureCoefficient * prefixSum[k]! + powerCapKw * (N - k);
  const meanKw = sumKw / N;
  return meanKw / payloadRatingKw;
}

/**
 * Episode-level battery-smoothing contribution to the sea-park capacity
 * factor, deliberately NOT a minute-by-minute/hourly simulation. Walks the
 * chronological 3-hourly record once, finds consecutive-observation
 * episodes where wave-only compute power falls below installed payload, and
 * credits each episode `min(episodeShortfallEnergy, batteryEnergyKWh)` of
 * recovered energy -- favorable simplifying assumptions: the battery starts
 * each episode full, fully recharges from surplus between episodes,
 * charge/discharge is lossless, discharge power always covers the
 * instantaneous shortfall, and there is no degradation.
 *
 * Requires the ORIGINAL chronological order (not the sorted array), since
 * episode length/severity depends on run structure, not just the marginal
 * distribution: O(N) single pass. Depends on battery duration (via
 * batteryCapacityKwh), unlike rawWaveResourceCF.
 */
export function seaParkBatteryRecoveryFraction(params: SeaParkResourceParams, batteryCapacityKwh: number): number {
  const { captureCoefficient, powerCapKw, payloadRatingKw } = params;
  const dtHours = WAVERYS_META.intervalHours;
  const n = fluxChronological.length;
  let recoveredTotalKwh = 0;
  let i = 0;
  while (i < n) {
    const waveOnlyKw = Math.min(captureCoefficient * fluxChronological[i]!, powerCapKw);
    if (waveOnlyKw < payloadRatingKw) {
      let episodeShortfallKwh = 0;
      let j = i;
      while (j < n) {
        const w = Math.min(captureCoefficient * fluxChronological[j]!, powerCapKw);
        if (w >= payloadRatingKw) break;
        episodeShortfallKwh += (payloadRatingKw - w) * dtHours;
        j++;
      }
      recoveredTotalKwh += Math.min(episodeShortfallKwh, batteryCapacityKwh);
      i = j;
    } else {
      i++;
    }
  }
  const totalHours = n * dtHours;
  const avgRecoveryKw = recoveredTotalKwh / totalHours;
  return avgRecoveryKw / payloadRatingKw;
}

/**
 * Battery-adjusted energy-delivery sea-park factor: rawWaveResourceCF plus
 * the episode-level battery recovery fraction, capped at 1.0. This is what
 * chipFailures.ts / lcoe.ts / nodeFailureModes.ts multiply against healthy
 * compute capacity at sea park -- i.e. the value that actually drives
 * delivered energy, fleet sizing, and lifecycle cost. Never displayed
 * directly on the dashboard.
 */
export function effectiveSeaParkCF(params: SeaParkResourceParams, batteryCapacityKwh: number): number {
  const raw = rawWaveResourceCF(params);
  const recovery = seaParkBatteryRecoveryFraction(params, batteryCapacityKwh);
  return Math.min(1, raw + recovery);
}

// ---------------------------------------------------------------------------
// Descriptive dashboard metrics: resource capacity factor, rated power
// availability, keepalive availability. None of this feeds energy delivery,
// fleet sizing, or cost -- see module docs and derived.ts.
// ---------------------------------------------------------------------------

interface FullPowerLull {
  durationHours: number;
  /** Sum over this lull's observations of (ratedServerPowerKw - serverPowerKw[t]) * dtHours. */
  deficitFromRatedKwh: number;
  /**
   * Per-observation (ratedServerPowerKw - serverPowerKw[t]) for every
   * observation in this lull, in chronological order. Needed only by
   * computeResourceCapacityFactor's per-observation idle clamp -- a lull's
   * aggregate deficit alone isn't enough to know how many of its
   * observations fall below the idle floor once battery is applied.
   */
  perObservationDeficitFromRatedKw: Float64Array;
}

interface KeepaliveLull {
  durationHours: number;
  /** Sum over this lull's observations of (idlePowerKw - serverPowerKw[t]) * dtHours. */
  deficitFromIdleKwh: number;
}

interface DescriptiveResourceDistribution {
  totalHistoricalHours: number;
  /** Natural (no-battery) hours at/above rated power. */
  naturalFullPowerHours: number;
  /** Natural (no-battery) hours at/above the idle-power floor. */
  naturalKeepaliveHours: number;
  ratedServerPowerKw: number;
  idlePowerKw: number;
  maxUsefulWorkPowerKw: number;
  fullPowerLulls: FullPowerLull[];
  keepaliveLulls: KeepaliveLull[];
}

// Rebuilding is an O(N) pass over the full 46-year (3-hourly) record, so the
// result is cached by (captureCoefficient, powerCapKw) -- the only two
// numbers the full-power threshold, the idle-power floor (a fixed fraction
// of powerCapKw), and per-observation server power all depend on. Battery
// duration is not one of them, so changing it alone always hits this cache;
// changing payload, hull diameter, PTO sizing, or efficiency changes
// captureCoefficient/powerCapKw and forces a rebuild.
let cachedDescriptiveParams: { captureCoefficient: number; powerCapKw: number; idlePowerFraction: number } | null = null;
let cachedDescriptiveDistribution: DescriptiveResourceDistribution | null = null;

/**
 * Walks the historical record twice (once per threshold, chronological
 * order) to find every full-power lull and every keepalive lull, with each
 * lull's duration and aggregate energy deficit -- plus, for full-power
 * lulls only, the per-observation deficit needed for the idle clamp in
 * computeResourceCapacityFactor. This is the only expensive step in the
 * three descriptive metrics; everything battery-duration-dependent
 * downstream is a cheap pass over the much smaller lull arrays, not a
 * rescan of the raw 46-year series.
 *
 * idlePowerFraction defaults to the fixed CONST.server_idle_power_fraction;
 * the app (derived.ts) never overrides it -- there is no dashboard slider
 * for it. The parameter exists only so tests can verify that Rated Power
 * Availability's threshold is genuinely independent of the idle-power
 * assumption (it doesn't reference idlePowerKw at all), which isn't
 * otherwise observable from the outside.
 */
function getDescriptiveResourceDistribution(
  params: SeaParkResourceParams,
  idlePowerFraction: number = CONST.server_idle_power_fraction,
): DescriptiveResourceDistribution {
  if (
    cachedDescriptiveDistribution &&
    cachedDescriptiveParams &&
    cachedDescriptiveParams.captureCoefficient === params.captureCoefficient &&
    cachedDescriptiveParams.powerCapKw === params.powerCapKw &&
    cachedDescriptiveParams.idlePowerFraction === idlePowerFraction
  ) {
    return cachedDescriptiveDistribution;
  }

  const { captureCoefficient, powerCapKw } = params;
  // ratedServerPowerKw == powerCapKw by construction in this model (PTO is
  // always sized above payload -- see CONST.pto_payload_multiplier), so
  // thresholding against powerCapKw is equivalent to thresholding against
  // payloadRatingKw directly, and also matches the min() cap already
  // applied to serverPowerKw below.
  const ratedServerPowerKw = powerCapKw;
  const idlePowerKw = ratedServerPowerKw * idlePowerFraction;
  const maxUsefulWorkPowerKw = ratedServerPowerKw - idlePowerKw;
  const dtHours = WAVERYS_META.intervalHours;
  const n = fluxChronological.length;

  const serverPowerKw = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    serverPowerKw[t] = Math.min(captureCoefficient * fluxChronological[t]!, powerCapKw);
  }

  let naturalFullPowerHours = 0;
  const fullPowerLulls: FullPowerLull[] = [];
  let i = 0;
  while (i < n) {
    if (serverPowerKw[i]! >= ratedServerPowerKw) {
      naturalFullPowerHours += dtHours;
      i++;
      continue;
    }
    let j = i;
    let durationHours = 0;
    let deficitFromRatedKwh = 0;
    const perObservationDeficitFromRatedKw: number[] = [];
    while (j < n && serverPowerKw[j]! < ratedServerPowerKw) {
      const deficitKw = ratedServerPowerKw - serverPowerKw[j]!;
      perObservationDeficitFromRatedKw.push(deficitKw);
      deficitFromRatedKwh += deficitKw * dtHours;
      durationHours += dtHours;
      j++;
    }
    fullPowerLulls.push({
      durationHours,
      deficitFromRatedKwh,
      perObservationDeficitFromRatedKw: Float64Array.from(perObservationDeficitFromRatedKw),
    });
    i = j;
  }

  let naturalKeepaliveHours = 0;
  const keepaliveLulls: KeepaliveLull[] = [];
  i = 0;
  while (i < n) {
    if (serverPowerKw[i]! >= idlePowerKw) {
      naturalKeepaliveHours += dtHours;
      i++;
      continue;
    }
    let j = i;
    let durationHours = 0;
    let deficitFromIdleKwh = 0;
    while (j < n && serverPowerKw[j]! < idlePowerKw) {
      deficitFromIdleKwh += (idlePowerKw - serverPowerKw[j]!) * dtHours;
      durationHours += dtHours;
      j++;
    }
    keepaliveLulls.push({ durationHours, deficitFromIdleKwh });
    i = j;
  }

  cachedDescriptiveDistribution = {
    totalHistoricalHours: n * dtHours,
    naturalFullPowerHours,
    naturalKeepaliveHours,
    ratedServerPowerKw,
    idlePowerKw,
    maxUsefulWorkPowerKw,
    fullPowerLulls,
    keepaliveLulls,
  };
  cachedDescriptiveParams = { captureCoefficient, powerCapKw, idlePowerFraction };
  return cachedDescriptiveDistribution;
}

/**
 * Resource capacity factor -- the dashboard's headline descriptive metric:
 * useful compute work actually available, relative to a theoretically
 * perfect continuous-full-power environment. "Useful work" is server power
 * above the fixed idle-power floor (a server merely idling isn't doing
 * useful compute work) -- this is NOT average server power divided by rated
 * power; the idle floor must be subtracted first.
 *
 * Full-rated-power hours contribute their full maxUsefulWorkPowerKw. Within
 * each historical full-power lull, the battery is assumed to start fully
 * charged and close a fraction q = min(1, batteryCapacityKwh /
 * lullDeficitKwh) of that lull's power deficit throughout the whole lull
 * (not simulated timestep-by-timestep); each observation's own useful-work
 * contribution is then clamped at zero once its (battery-assisted) power
 * still falls below the idle floor. This per-observation clamp is why the
 * lull-level deficit alone isn't sufficient -- see perObservationDeficitFromRatedKw.
 */
export function computeResourceCapacityFactor(
  params: SeaParkResourceParams,
  batteryCapacityKwh: number,
  idlePowerFraction: number = CONST.server_idle_power_fraction,
): number {
  const dist = getDescriptiveResourceDistribution(params, idlePowerFraction);
  const dtHours = WAVERYS_META.intervalHours;

  let usefulWorkKwh = dist.naturalFullPowerHours * dist.maxUsefulWorkPowerKw;
  for (const lull of dist.fullPowerLulls) {
    const q = lull.deficitFromRatedKwh > 0 ? Math.min(1, batteryCapacityKwh / lull.deficitFromRatedKwh) : 0;
    for (const deficitKw of lull.perObservationDeficitFromRatedKw) {
      const effectiveUsefulKw = Math.max(0, dist.maxUsefulWorkPowerKw - (1 - q) * deficitKw);
      usefulWorkKwh += effectiveUsefulKw * dtHours;
    }
  }

  const cf = usefulWorkKwh / (dist.maxUsefulWorkPowerKw * dist.totalHistoricalHours);
  return Math.min(1, Math.max(0, cf));
}

/**
 * Rated power availability -- share of historical time the full installed
 * compute payload can operate at 100% rated power (no partial credit for a
 * lull). This is the calculation the dashboard used to label "Resource
 * capacity factor"; it is a genuine share-of-time metric, not an energy
 * average, so it is NOT called a capacity factor anywhere in this codebase.
 * Uses the same full-power lulls and battery coverage fraction q as
 * computeResourceCapacityFactor.
 */
export function computeRatedPowerAvailability(
  params: SeaParkResourceParams,
  batteryCapacityKwh: number,
  idlePowerFraction: number = CONST.server_idle_power_fraction,
): number {
  // idlePowerFraction only affects the *cache key* here, not this function's
  // own formula (it never references idlePowerKw) -- passed through purely
  // so tests can confirm the result is identical regardless of its value.
  const dist = getDescriptiveResourceDistribution(params, idlePowerFraction);
  let recoveredHours = 0;
  for (const lull of dist.fullPowerLulls) {
    const q = lull.deficitFromRatedKwh > 0 ? Math.min(1, batteryCapacityKwh / lull.deficitFromRatedKwh) : 0;
    recoveredHours += q * lull.durationHours;
  }
  const availability = (dist.naturalFullPowerHours + recoveredHours) / dist.totalHistoricalHours;
  return Math.min(1, Math.max(0, availability));
}

/**
 * Keepalive availability -- share of historical time there is enough power
 * to keep the servers powered at their idle requirement (CONST.server_idle_power_fraction
 * of rated payload), even if not enough to do any useful compute work. Uses
 * its own, separate lull grouping (the idle-power floor is a much lower bar
 * than full rated power, so keepalive lulls are rarer/shorter than
 * full-power lulls) and its own independent battery coverage fraction --
 * this is a separate descriptive calculation, not jointly optimized against
 * the other two metrics' battery usage.
 */
export function computeKeepaliveAvailability(
  params: SeaParkResourceParams,
  batteryCapacityKwh: number,
  idlePowerFraction: number = CONST.server_idle_power_fraction,
): number {
  const dist = getDescriptiveResourceDistribution(params, idlePowerFraction);
  let recoveredHours = 0;
  for (const lull of dist.keepaliveLulls) {
    const q = lull.deficitFromIdleKwh > 0 ? Math.min(1, batteryCapacityKwh / lull.deficitFromIdleKwh) : 0;
    recoveredHours += q * lull.durationHours;
  }
  const availability = (dist.naturalKeepaliveHours + recoveredHours) / dist.totalHistoricalHours;
  return Math.min(1, Math.max(0, availability));
}
