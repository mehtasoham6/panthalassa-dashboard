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
 * PTO cap) move the capacity-factor outputs below.
 *
 * This module deliberately exposes TWO independent capacity-factor
 * calculations that must not be conflated:
 *
 *  1. rawWaveResourceCF / seaParkBatteryRecoveryFraction / effectiveSeaParkCF
 *     -- the original energy-average formula. effectiveSeaParkCF is what
 *     chipFailures.ts / lcoe.ts / nodeFailureModes.ts actually multiply
 *     against healthy compute capacity to schedule sea-park energy, and
 *     therefore what drives fleet sizing and lifecycle cost. This is
 *     unchanged model logic -- battery duration affects it exactly as it
 *     always has.
 *  2. getLullDistribution / waveOnlyFullPowerAvailability /
 *     effectiveResourceCapacityFactor -- a share-of-time "can the node
 *     sustain full rated output right now" metric (no partial credit),
 *     with battery folded in via a lull-by-lull energy-deficit
 *     approximation (assume full charge at the start of every historical
 *     lull; no chronological state-of-charge simulation). This is used
 *     ONLY for the dashboard's "Resource capacity factor" display tile
 *     (derived.resource_capacity_factor) -- it does not feed energy
 *     delivery, fleet sizing, or cost anywhere. It is intentionally a purer
 *     "how available is the resource" readout than #1, at the cost of not
 *     being the exact number the model internally assumes for delivered
 *     energy.
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
// series (needed for both the lull scan and the episode-level battery scan)
// and a sorted copy with a prefix sum (for O(log N) energy-average CF
// lookups) are both built a single time at module load.
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
  /** min(payload, PTO) equipment cap. */
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
 * directly on the dashboard (see effectiveResourceCapacityFactor for that).
 */
export function effectiveSeaParkCF(params: SeaParkResourceParams, batteryCapacityKwh: number): number {
  const raw = rawWaveResourceCF(params);
  const recovery = seaParkBatteryRecoveryFraction(params, batteryCapacityKwh);
  return Math.min(1, raw + recovery);
}

export interface SeaParkLull {
  lullDurationHours: number;
  lullEnergyDeficitKwh: number;
}

export interface LullDistribution {
  totalHistoricalHours: number;
  fullPowerHours: number;
  lulls: SeaParkLull[];
}

// Rebuilding is an O(N) pass over the full 46-year (3-hourly) record, so the
// result is cached by (captureCoefficient, powerCapKw) -- the only two
// numbers the full-power threshold and per-observation wave power depend
// on. Battery duration is not one of them, so changing it alone always hits
// this cache; changing payload, hull diameter, PTO sizing, or efficiency
// changes captureCoefficient/powerCapKw and forces a rebuild.
let cachedLullParams: { captureCoefficient: number; powerCapKw: number } | null = null;
let cachedDistribution: LullDistribution | null = null;

/**
 * Walks the historical record once (chronological order) to find every
 * full-power observation and every consecutive run of below-threshold
 * ("lull") observations, with each lull's total duration and aggregate
 * energy deficit against the full-power cap. This is the only expensive
 * step in the dashboard-display capacity-factor calculation; everything
 * downstream (battery coverage, recovered hours) is a cheap pass over the
 * much smaller `lulls` array. This distribution feeds ONLY the dashboard
 * display metric -- see module docs.
 */
export function getLullDistribution(params: SeaParkResourceParams): LullDistribution {
  if (
    cachedDistribution &&
    cachedLullParams &&
    cachedLullParams.captureCoefficient === params.captureCoefficient &&
    cachedLullParams.powerCapKw === params.powerCapKw
  ) {
    return cachedDistribution;
  }

  const { captureCoefficient, powerCapKw } = params;
  const dtHours = WAVERYS_META.intervalHours;
  const n = fluxChronological.length;
  let fullPowerHours = 0;
  const lulls: SeaParkLull[] = [];

  let i = 0;
  while (i < n) {
    const wavePowerKw = Math.min(captureCoefficient * fluxChronological[i]!, powerCapKw);
    if (wavePowerKw >= powerCapKw) {
      fullPowerHours += dtHours;
      i++;
      continue;
    }
    let lullDurationHours = 0;
    let lullEnergyDeficitKwh = 0;
    let j = i;
    while (j < n) {
      const wKw = Math.min(captureCoefficient * fluxChronological[j]!, powerCapKw);
      if (wKw >= powerCapKw) break;
      lullDurationHours += dtHours;
      lullEnergyDeficitKwh += (powerCapKw - wKw) * dtHours;
      j++;
    }
    lulls.push({ lullDurationHours, lullEnergyDeficitKwh });
    i = j;
  }

  cachedDistribution = { totalHistoricalHours: n * dtHours, fullPowerHours, lulls };
  cachedLullParams = { captureCoefficient, powerCapKw };
  return cachedDistribution;
}

/**
 * Wave-only full-power availability: share of historical time the node can
 * sustain full rated output from wave resource alone, with no battery
 * assist. Internal/debugging value -- see effectiveResourceCapacityFactor
 * for the dashboard's actual "Resource capacity factor" display metric.
 */
export function waveOnlyFullPowerAvailability(params: SeaParkResourceParams): number {
  const { totalHistoricalHours, fullPowerHours } = getLullDistribution(params);
  return fullPowerHours / totalHistoricalHours;
}

/**
 * Battery-adjusted resource capacity factor -- the dashboard's single
 * "Resource capacity factor" display metric (derived.resource_capacity_factor).
 * This does NOT feed energy delivery/fleet sizing/cost -- see module docs
 * and effectiveSeaParkCF for that separate, unchanged calculation.
 *
 * For each historical lull, assumes the battery starts fully charged (a
 * simplifying approximation -- not a chronological state-of-charge
 * simulation) and credits min(batteryCapacityKwh, lullEnergyDeficitKwh) of
 * that lull's deficit as covered. The covered *energy* fraction is applied
 * proportionally to the lull's *hours* (recovered_hours = duration *
 * coverage_fraction) rather than attempting to identify which specific
 * hours within the lull the battery covers -- an intentional approximation
 * that preserves the historical distribution of lull sizes (a battery can
 * fully cover many small lulls while covering only a sliver of rare large
 * ones) instead of comparing against one average lull.
 */
export function effectiveResourceCapacityFactor(params: SeaParkResourceParams, batteryCapacityKwh: number): number {
  const { totalHistoricalHours, fullPowerHours, lulls } = getLullDistribution(params);

  let recoveredHours = 0;
  for (const lull of lulls) {
    const coverageFraction =
      lull.lullEnergyDeficitKwh > 0 ? Math.min(1, batteryCapacityKwh / lull.lullEnergyDeficitKwh) : 0;
    recoveredHours += lull.lullDurationHours * coverageFraction;
  }

  const cf = (fullPowerHours + recoveredHours) / totalHistoricalHours;
  return Math.min(1, Math.max(0, cf));
}
