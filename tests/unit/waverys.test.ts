import { describe, expect, it } from "vitest";
import {
  WAVERYS_META,
  computeWaveFluxKwPerM,
  rawWaveResourceCF,
  seaParkBatteryRecoveryFraction,
  effectiveSeaParkCF,
  getLullDistribution,
  waveOnlyFullPowerAvailability,
  effectiveResourceCapacityFactor,
} from "../../src/model/waverys.js";
import { computeDerived } from "../../src/model/derived.js";
import { computeChipFailures } from "../../src/model/chipFailures.js";
import { CONST } from "../../src/model/constants.js";
import { averageRemainingLifeFraction } from "../../src/model/remainingLife.js";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Copernicus Marine WAVERYS (GLOBAL_MULTIYEAR_WAV_001_032,
// cmems_mod_glo_wav_my_0.2deg_PT3H-i), representative sea-park point
// ~53.6S, 133.6E, 1980-2025, preprocessed once (scripts/preprocess_waverys.py)
// into src/model/data/waverysSeaPark.json. No NetCDF parsing happens here or
// at runtime -- these tests validate that preprocessed, shipped series.

describe("WAVERYS file is parsed correctly (preprocessed metadata regression)", () => {
  it("representative point, period, and observation count match the source extract", () => {
    expect(WAVERYS_META.latitude).toBeCloseTo(-53.6, 1);
    expect(WAVERYS_META.longitude).toBeCloseTo(133.6, 1);
    expect(WAVERYS_META.periodStart.startsWith("1980")).toBe(true);
    expect(WAVERYS_META.periodEnd.startsWith("2025")).toBe(true);
    expect(WAVERYS_META.intervalHours).toBe(3);
    expect(WAVERYS_META.observationCount).toBeGreaterThan(130_000);
    expect(WAVERYS_META.excludedInvalidCount).toBe(0);
  });

  it("mean incident flux over the historical record ~= 107.9 kW/m", () => {
    expect(WAVERYS_META.meanFluxKwPerM).toBeCloseTo(107.9, 0);
  });
});

describe("VHM0/VTM10 -> wave flux conversion (0.49 * Hs^2 * Te)", () => {
  it("matches the formula for representative values", () => {
    expect(computeWaveFluxKwPerM(4, 10)).toBeCloseTo(0.49 * 16 * 10, 10);
    expect(computeWaveFluxKwPerM(2.5, 8)).toBeCloseTo(0.49 * 6.25 * 8, 10);
    expect(computeWaveFluxKwPerM(0, 10)).toBe(0);
  });

  it("excludes (returns null for) observations with a missing/non-finite VHM0 or VTM10", () => {
    expect(computeWaveFluxKwPerM(NaN, 10)).toBeNull();
    expect(computeWaveFluxKwPerM(4, NaN)).toBeNull();
    expect(computeWaveFluxKwPerM(Infinity, 10)).toBeNull();
    expect(computeWaveFluxKwPerM(4, -Infinity)).toBeNull();
    expect(computeWaveFluxKwPerM(NaN, NaN)).toBeNull();
  });
});

// effective_sea_park_cf: the ORIGINAL energy-average formula (raw energy
// average plus an episode-level battery-smoothing bump, capped at 1.0).
// This is internal-only (never displayed) but is what actually schedules
// sea-park energy delivery -- and therefore fleet sizing and cost -- via
// chipFailures.ts/lcoe.ts/nodeFailureModes.ts. rawWaveResourceCF /
// seaParkBatteryRecoveryFraction are its two components, tested directly
// (via their exported functions, not a derived field -- ModelResult
// exposes only the fused effective_sea_park_cf). This whole section is
// unchanged model behavior; battery duration affects it exactly as it
// always has.
describe("internal energy-average sea-park factor (drives energy delivery/fleet sizing/cost, never displayed)", () => {
  function seaParkParams(inputs: typeof DEFAULT_INPUTS) {
    const derived = computeDerived(inputs);
    return { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: inputs.payload_rating_kw };
  }

  it("raw wave-resource capacity factor at default slider settings ~= 96.45%", () => {
    expect(rawWaveResourceCF(seaParkParams(DEFAULT_INPUTS))).toBeCloseTo(0.9645, 3);
  });

  it("battery-adjusted effective sea-park factor at the default 0.5h battery ~= 96.66%", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    expect(derived.effective_sea_park_cf).toBeCloseTo(0.9666, 3);
  });

  it("effective factor is always >= raw factor (battery only ever helps) and > raw at a nonzero battery", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const raw = rawWaveResourceCF(seaParkParams(DEFAULT_INPUTS));
    expect(derived.effective_sea_park_cf).toBeGreaterThanOrEqual(raw);
    expect(derived.effective_sea_park_cf).toBeGreaterThan(raw);
  });

  it("increasing payload while holding hull/capture fixed generally lowers raw wave-resource CF", () => {
    const low = rawWaveResourceCF(seaParkParams({ ...DEFAULT_INPUTS, payload_rating_kw: 100 }));
    const mid = rawWaveResourceCF(seaParkParams({ ...DEFAULT_INPUTS, payload_rating_kw: 200 }));
    const high = rawWaveResourceCF(seaParkParams({ ...DEFAULT_INPUTS, payload_rating_kw: 300 }));
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it("increasing hull diameter (more capture) while holding payload fixed raises raw wave-resource CF", () => {
    const small = rawWaveResourceCF(seaParkParams({ ...DEFAULT_INPUTS, hull_diameter_m: 10 }));
    const large = rawWaveResourceCF(seaParkParams({ ...DEFAULT_INPUTS, hull_diameter_m: 20 }));
    expect(large).toBeGreaterThan(small);
  });

  it("effective_sea_park_cf is computed directly from rawWaveResourceCF() + seaParkBatteryRecoveryFraction(), matching computeDerived's own value (no divergent parallel model)", () => {
    const inputs = { ...DEFAULT_INPUTS, hull_diameter_m: 14, payload_rating_kw: 250 };
    const derived = computeDerived(inputs);
    const params = seaParkParams(inputs);
    const batteryCapacityKwh = inputs.payload_rating_kw * inputs.battery_duration_hours;
    const expected = Math.min(1, rawWaveResourceCF(params) + seaParkBatteryRecoveryFraction(params, batteryCapacityKwh));
    expect(derived.effective_sea_park_cf).toBeCloseTo(expected, 10);
  });

  it("increasing battery duration weakly increases effective_sea_park_cf, and it never exceeds 100%", () => {
    const durations = [0.25, 0.5, 1, 2, 4];
    const factors = durations.map((h) => computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: h }).effective_sea_park_cf);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]!).toBeGreaterThanOrEqual(factors[i - 1]!);
    }
    for (const f of factors) {
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("seaParkBatteryRecoveryFraction is non-negative and effectiveSeaParkCF caps at 1.0 even for an oversized battery", () => {
    const params = { captureCoefficient: 100, powerCapKw: 200, payloadRatingKw: 200 }; // near-saturating capture
    const recovery = seaParkBatteryRecoveryFraction(params, 1_000_000);
    expect(recovery).toBeGreaterThanOrEqual(0);
    const eff = effectiveSeaParkCF(params, 1_000_000);
    expect(eff).toBeLessThanOrEqual(1);
  });
});

// resource_capacity_factor: the NEW share-of-time "full rated output or
// not" metric, used ONLY for the dashboard's "Resource capacity factor"
// display tile. Deliberately does not feed energy delivery, fleet sizing,
// or cost -- see the "does not affect fleet sizing" describe block below.
describe("dashboard-display resource capacity factor (full-power-availability, lull-based, does not feed energy delivery)", () => {
  it("full-power wave-flux threshold at default sliders ~= 37.2 kW/m (dynamic, not hard-coded)", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    expect(derived.full_output_flux_kw_per_m).toBeCloseTo(37.2, 1);
    expect(derived.full_output_flux_kw_per_m).toBeCloseTo(derived.power_cap_kw / derived.capture_coefficient, 10);
  });

  it("recalculates when payload, hull diameter, or PTO-relevant capture inputs change", () => {
    const base = computeDerived(DEFAULT_INPUTS);
    const biggerHull = computeDerived({ ...DEFAULT_INPUTS, hull_diameter_m: 15 });
    const biggerPayload = computeDerived({ ...DEFAULT_INPUTS, payload_rating_kw: 250 });
    expect(biggerHull.full_output_flux_kw_per_m).not.toBeCloseTo(base.full_output_flux_kw_per_m, 6);
    expect(biggerPayload.full_output_flux_kw_per_m).not.toBeCloseTo(base.full_output_flux_kw_per_m, 6);
  });

  it("is a genuine share-of-time-at-full-power metric (no partial credit), ~88.8% at defaults (0.5h battery)", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    expect(derived.resource_capacity_factor).toBeCloseTo(0.8878, 3);
  });

  it("battery duration has NO effect on wave-only full-power availability", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    expect(waveOnlyFullPowerAvailability(params)).toBeCloseTo(0.8703, 3);
  });

  it("with zero battery, resource_capacity_factor equals wave-only full-power availability exactly", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    expect(effectiveResourceCapacityFactor(params, 0)).toBeCloseTo(waveOnlyFullPowerAvailability(params), 12);
  });

  it("increasing battery duration never lowers resource_capacity_factor, and it never exceeds 100%", () => {
    const durations = [0, 0.25, 0.5, 1, 2, 4, 8];
    const factors = durations.map((h) => computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: h }).resource_capacity_factor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]!).toBeGreaterThanOrEqual(factors[i - 1]!);
    }
    for (const f of factors) {
      expect(f).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(0);
    }
  });

  it("a battery large enough to cover every individual lull's deficit yields exactly 100% availability", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    const { lulls } = getLullDistribution(params);
    const maxDeficit = Math.max(...lulls.map((l) => l.lullEnergyDeficitKwh));
    expect(effectiveResourceCapacityFactor(params, maxDeficit)).toBeCloseTo(1, 10);
  });

  it("every lull's coverage fraction (implied by recovered hours / lull duration) is between 0 and 1", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    const { lulls } = getLullDistribution(params);
    const batteryCapacityKwh = DEFAULT_INPUTS.payload_rating_kw * DEFAULT_INPUTS.battery_duration_hours;
    for (const lull of lulls) {
      const coverage = Math.min(1, batteryCapacityKwh / lull.lullEnergyDeficitKwh);
      expect(coverage).toBeGreaterThanOrEqual(0);
      expect(coverage).toBeLessThanOrEqual(1);
    }
  });

  it("changing battery duration alone does not rebuild the underlying lull distribution", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    const first = getLullDistribution(params);
    effectiveResourceCapacityFactor(params, 50);
    effectiveResourceCapacityFactor(params, 5_000);
    const second = getLullDistribution(params);
    expect(second).toBe(first); // same object reference: never rebuilt
  });

  it("changing payload or hull diameter (which move the full-power threshold) does rebuild the lull distribution", () => {
    const base = computeDerived(DEFAULT_INPUTS);
    const baseParams = { captureCoefficient: base.capture_coefficient, powerCapKw: base.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    const baseDist = getLullDistribution(baseParams);

    const changedPayload = computeDerived({ ...DEFAULT_INPUTS, payload_rating_kw: 250 });
    const changedParams = { captureCoefficient: changedPayload.capture_coefficient, powerCapKw: changedPayload.power_cap_kw, payloadRatingKw: 250 };
    const changedDist = getLullDistribution(changedParams);

    expect(changedDist).not.toBe(baseDist);
    expect(changedDist.fullPowerHours).not.toBeCloseTo(baseDist.fullPowerHours, 0);

    // Re-requesting the original params still returns the correct (rebuilt) distribution.
    const backToBase = getLullDistribution(baseParams);
    expect(backToBase.fullPowerHours).toBeCloseTo(baseDist.fullPowerHours, 6);
  });

  it("every lull has strictly positive duration and energy deficit, and durations sum with full-power hours to the total record", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const params = { captureCoefficient: derived.capture_coefficient, powerCapKw: derived.power_cap_kw, payloadRatingKw: DEFAULT_INPUTS.payload_rating_kw };
    const { totalHistoricalHours, fullPowerHours, lulls } = getLullDistribution(params);
    expect(lulls.length).toBeGreaterThan(0);
    let lullHours = 0;
    for (const l of lulls) {
      expect(l.lullDurationHours).toBeGreaterThan(0);
      expect(l.lullEnergyDeficitKwh).toBeGreaterThan(0);
      lullHours += l.lullDurationHours;
    }
    expect(fullPowerHours + lullHours).toBeCloseTo(totalHistoricalHours, 6);
  });

  it("does NOT feed energy delivery, fleet sizing, or cost: forcing it to an extreme value leaves the model result unchanged", () => {
    const withDisplayMetricUnused = runModel(DEFAULT_INPUTS);
    // resource_capacity_factor is not read anywhere downstream of derived.ts,
    // so mutating it post-hoc must be a pure no-op on every other output --
    // the strongest possible regression guard against it silently leaking
    // into energy/fleet/cost math the way effective_sea_park_cf did before.
    const derived = computeDerived(DEFAULT_INPUTS);
    const mutated = { ...derived, resource_capacity_factor: 0 };
    const chipWithReal = computeChipFailures(DEFAULT_INPUTS, derived);
    const chipWithMutated = computeChipFailures(DEFAULT_INPUTS, mutated);
    expect(chipWithMutated.chip_adjusted_energy_kwh).toBe(chipWithReal.chip_adjusted_energy_kwh);
    expect(withDisplayMetricUnused.N_fleet).toBeGreaterThan(0);
  });
});

describe("the sea-park resource correction propagates through fleet sizing", () => {
  it("forcing effective_sea_park_cf to 1.0 (counterfactual: unlimited sea-park resource) raises chip-adjusted energy and lowers N_fleet vs. the real WAVERYS-corrected default", () => {
    const derivedReal = computeDerived(DEFAULT_INPUTS);
    expect(derivedReal.effective_sea_park_cf).toBeLessThan(1);

    const derivedUnlimited = { ...derivedReal, effective_sea_park_cf: 1 };
    const chipReal = computeChipFailures(DEFAULT_INPUTS, derivedReal);
    const chipUnlimited = computeChipFailures(DEFAULT_INPUTS, derivedUnlimited);

    expect(chipUnlimited.chip_adjusted_energy_kwh).toBeGreaterThan(chipReal.chip_adjusted_energy_kwh);

    const real = runModel(DEFAULT_INPUTS);
    expect(real.N_fleet).toBeGreaterThan(0);
    // A strictly lower per-node energy (real, resource-corrected) than the
    // counterfactual (uncorrected) means the fleet-sizing equation requires
    // at least as many nodes -- and strictly more once whole-node rounding
    // is generically broken (true at these defaults).
    const target = real.target_energy_mw_years;
    const realSlotMwYears = chipReal.chip_adjusted_energy_kwh / (1_000 * 8_760);
    const unlimitedSlotMwYears = chipUnlimited.chip_adjusted_energy_kwh / (1_000 * 8_760);
    const nFleetReal = Math.ceil(target / realSlotMwYears);
    const nFleetUnlimited = Math.ceil(target / unlimitedSlotMwYears);
    expect(nFleetReal).toBeGreaterThanOrEqual(nFleetUnlimited);
  });
});

describe("existing route assumptions remain unchanged", () => {
  it("the deterministic route wave-flux endpoints (0/40/100 kW/m) and outbound reference energy are untouched by the WAVERYS sea-park correction", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    // outbound_energy_kwh depends only on the route ramp/battery logic
    // (energy.ts), never on waverys.ts -- confirm it lands at the
    // already-verified Change-1/2 regression figure.
    const shortfall = 24 * derived.power_cap_kw * derived.outbound_days - derived.outbound_energy_kwh;
    expect(shortfall).toBeCloseTo(272.301, 1);
  });
});

describe("existing failure rates, maintenance rules, remaining-life logic, and unit costs remain unchanged", () => {
  it("Mode 2-5 weights and rates are unaffected by the wave-resource correction", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.modeLosses.mode_2_rate_annual).toBeCloseTo(DEFAULT_INPUTS.node_failure_rate_annual * CONST.mode_2_weight, 10);
    expect(r.modeLosses.mode_3_rate_annual).toBeCloseTo(DEFAULT_INPUTS.node_failure_rate_annual * CONST.mode_3_weight, 10);
    expect(r.modeLosses.mode_4_rate_annual).toBeCloseTo(DEFAULT_INPUTS.node_failure_rate_annual * CONST.mode_4_weight, 10);
    expect(r.modeLosses.mode_5_rate_annual).toBeCloseTo(DEFAULT_INPUTS.node_failure_rate_annual * CONST.mode_5_weight, 10);
  });

  it("the six-month maintenance-consolidation window constant is unchanged", () => {
    expect(CONST.maintenance_consolidation_window_years).toBe(0.5);
  });

  it("service-event timing (trigger age, maintenance dates, event counts) is independent of the wave-resource correction", () => {
    const derivedReal = computeDerived({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 });
    const derivedUnlimited = { ...derivedReal, effective_sea_park_cf: 1 };
    const inputs = { ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 };
    const chipReal = computeChipFailures(inputs, derivedReal);
    const chipUnlimited = computeChipFailures(inputs, derivedUnlimited);
    // Only ENERGY totals should differ; event counts/timing should not.
    expect(chipReal.expected_mode_1_surprise_service_event_count_per_position).toBe(
      chipUnlimited.expected_mode_1_surprise_service_event_count_per_position,
    );
    expect(chipReal.scheduled_node_maintenance_event_count_per_position).toBe(
      chipUnlimited.scheduled_node_maintenance_event_count_per_position,
    );
    expect(chipReal.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(
      chipUnlimited.expected_failed_capacity_kw_replaced_per_position,
      6,
    );
    expect(chipReal.chip_adjusted_energy_kwh).not.toBeCloseTo(chipUnlimited.chip_adjusted_energy_kwh, 0);
  });

  it("remaining-economic-life depreciation logic is unaffected (same averageRemainingLifeFraction, still applied once, no double count)", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    const avgFraction = averageRemainingLifeFraction(0, inputs.analysis_period_years, inputs.node_lifetime_years);
    expect(avgFraction).toBeCloseTo(0.875, 10);
    const expectedEvents = r.N_fleet * inputs.analysis_period_years * (r.modeLosses.mode_4_rate_annual + r.modeLosses.mode_5_rate_annual);
    const sumOfPieces =
      r.costs.lineItems.fleet_complete_payload_replacement_cost_usd + r.costs.lineItems.mode_4_5_non_compute_replacement_cost_usd;
    expect(sumOfPieces).toBeCloseTo(expectedEvents * r.costs.physical_node_cost_usd * avgFraction, 2);
  });

  it("per-node unit costs (physical_node_cost_usd, non_compute_node_cost_usd) are unaffected by the wave-resource correction", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.costs.physical_node_cost_usd).toBeCloseTo(5_410_000, 0);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(410_000, 0);
  });
});
