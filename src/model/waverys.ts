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
 * PTO cap) move the capacity-factor outputs below. Battery duration affects
 * only `seaParkBatteryRecoveryFraction`/`effectiveSeaParkCF`, never
 * `rawWaveResourceCF`.
 *
 * `rawWaveResourceCF` is the only wave-resource number ever displayed on the
 * dashboard. `effectiveSeaParkCF` (raw + a favorable episode-level battery
 * smoothing approximation, capped at 1.0) is used internally to schedule
 * sea-park energy and is intentionally never shown as a second UI metric.
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
// series (needed for the episode-level battery scan) and a sorted copy with
// a prefix sum (for O(log N) raw-CF lookups) are both built a single time at
// module load.
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
  /** Installed compute-payload cap -- the capacity-factor denominator. */
  payloadRatingKw: number;
}

/**
 * Raw wave-resource capacity factor:
 *   mean(min(captureCoefficient * flux, powerCapKw)) / payloadRatingKw
 * over the full historical WAVERYS flux distribution at the representative
 * sea-park point. Order-independent (a sorted-distribution statistic), so it
 * is computed via a one-time sort + prefix sum rather than a per-call linear
 * scan: O(log N) per call. Does NOT depend on battery duration.
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
 * recovered energy -- favorable simplifying assumptions (documented in the
 * spec): the battery starts each episode full, fully recharges from surplus
 * between episodes, charge/discharge is lossless, discharge power always
 * covers the instantaneous shortfall, and there is no degradation.
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
 * Battery-adjusted internal sea-park factor: rawWaveResourceCF plus the
 * episode-level battery recovery fraction, capped at 1.0. Used only to
 * schedule sea-park energy inside the model -- never displayed as a second
 * dashboard capacity-factor metric.
 */
export function effectiveSeaParkCF(params: SeaParkResourceParams, batteryCapacityKwh: number): number {
  const raw = rawWaveResourceCF(params);
  const recovery = seaParkBatteryRecoveryFraction(params, batteryCapacityKwh);
  return Math.min(1, raw + recovery);
}
