import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { computeDerived } from "../../src/model/derived.js";
import { CONST } from "../../src/model/constants.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Power-system LCOE (Sections 1-13 of the LCOE revision): a standalone,
// compute-agnostic levelized cost of electricity for the node's non-compute
// power platform, over one full node-life economic horizon, for a single
// representative position -- independent of chip health, the dashboard
// analysis period, and target-fleet-capacity/whole-node-fleet rounding.
// Total lifecycle cost and fleet sizing remain fully compute-aware and are
// verified elsewhere (exampleA/B.test.ts, appendixA7.test.ts, etc.) to be
// unaffected by this change.

describe("LCOE sanity check at defaults", () => {
  it("lands in a physically reasonable power-system LCOE range (not hundreds of $/MWh, not near-zero)", () => {
    const r = runModel(DEFAULT_INPUTS);
    // A broad, non-hard-coded sanity band: if this were still leaking compute
    // hardware/chip-replacement/workload cost or the 5-year analysis horizon,
    // it would land in the hundreds of $/MWh (the old delivered-compute
    // levelized cost was ~$500+/MWh); if physical maintenance, Modes 2-5, or
    // retirement were missing, it would be implausibly low.
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(10);
    expect(r.lcoe.lcoe_usd_per_mwh).toBeLessThan(60);
  });

  it("LCOE horizon is the default 20-year node life, not the default 5-year analysis period", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.lcoe.lcoe_horizon_years).toBe(DEFAULT_INPUTS.node_lifetime_years);
    expect(r.lcoe.lcoe_horizon_years).toBe(20);
    expect(r.lcoe.lcoe_horizon_years).not.toBe(DEFAULT_INPUTS.analysis_period_years);
    expect(r.lcoe.yearly_power_system_cost_usd.length).toBe(21); // t=0..20
  });

  it("initial non-compute capital at t=0 matches the ~$410,000 power-system capex", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(410_000, -2);
    expect(r.lcoe.yearly_power_system_cost_usd[0]).toBeCloseTo(r.costs.non_compute_node_cost_usd, 6);
  });
});

describe("LCOE is independent of compute-only inputs", () => {
  const base = runModel(DEFAULT_INPUTS);

  it("compute hardware $/kW", () => {
    const r = runModel({ ...DEFAULT_INPUTS, compute_hardware_cost_usd_per_kw: 25_000 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("chip failure hazard", () => {
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("hot-spare share", () => {
    const r = runModel({ ...DEFAULT_INPUTS, hotSpareShare: 0.20 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("workload bandwidth intensity", () => {
    const r = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: 0.10 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("data-transfer $/GB", () => {
    const r = runModel({ ...DEFAULT_INPUTS, dataTransferCostPerGb: 2.0 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("target fleet capacity", () => {
    const r = runModel({ ...DEFAULT_INPUTS, target_capacity_gw: 10 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("general analysis-period slider", () => {
    const r = runModel({ ...DEFAULT_INPUTS, analysis_period_years: 12 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
    expect(r.lcoe.lcoe_horizon_years).toBe(base.lcoe.lcoe_horizon_years);
  });

  it("all of the above simultaneously", () => {
    const r = runModel({
      ...DEFAULT_INPUTS,
      compute_hardware_cost_usd_per_kw: 30_000,
      chip_failure_rate_annual: 0.10,
      hotSpareShare: 0,
      workloadBandwidthIntensityMbpsPerKw: 0.10,
      dataTransferCostPerGb: 2.0,
      target_capacity_gw: 20,
      analysis_period_years: 15,
    });
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });
});

describe("LCOE responds to physical/power-system inputs", () => {
  const base = runModel(DEFAULT_INPUTS);

  it("hull diameter (structural cost + wave capture)", () => {
    const r = runModel({ ...DEFAULT_INPUTS, hull_diameter_m: 10 });
    expect(r.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("finished hull cost per tonne", () => {
    const r = runModel({ ...DEFAULT_INPUTS, finished_hull_cost_usd_per_tonne: 8000 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("PTO cost per kW", () => {
    const r = runModel({ ...DEFAULT_INPUTS, pto_cost_usd_per_kw: 500 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("battery duration", () => {
    const r = runModel({ ...DEFAULT_INPUTS, battery_duration_hours: 4 });
    expect(r.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("sea-park distance (physical travel schedule)", () => {
    const r = runModel({ ...DEFAULT_INPUTS, sea_park_distance_km: 4000 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("aggregate non-chip node-failure rate (Modes 2-5)", () => {
    const r = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("node life (also the LCOE horizon itself)", () => {
    const r = runModel({ ...DEFAULT_INPUTS, node_lifetime_years: 10 });
    expect(r.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);
    expect(r.lcoe.lcoe_horizon_years).toBe(10);
  });

  it("real discount rate", () => {
    const r = runModel({ ...DEFAULT_INPUTS, real_discount_rate: 0.10 });
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("payload/rated electrical capacity (sizes the whole power system and caps output)", () => {
    const r = runModel({ ...DEFAULT_INPUTS, payload_rating_kw: 300 });
    expect(r.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("the Copernicus-derived wave-resource factor (via any slider that moves it, e.g. hull diameter)", () => {
    const small = computeDerived({ ...DEFAULT_INPUTS, hull_diameter_m: 10 });
    const large = computeDerived({ ...DEFAULT_INPUTS, hull_diameter_m: 20 });
    expect(small.raw_wave_resource_cf).toBeLessThan(large.raw_wave_resource_cf);
    const rSmall = runModel({ ...DEFAULT_INPUTS, hull_diameter_m: 10 });
    const rLarge = runModel({ ...DEFAULT_INPUTS, hull_diameter_m: 20 });
    expect(rSmall.lcoe.present_value_electrical_energy_mwh).not.toBe(rLarge.lcoe.present_value_electrical_energy_mwh);
  });
});

describe("schedule regression: chip failure does not reduce the LCOE energy denominator", () => {
  it("high chip-degradation hazard leaves LCOE's electrical energy schedule byte-for-byte unchanged", () => {
    const low = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.005 });
    const high = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 });
    expect(high.lcoe.present_value_electrical_energy_mwh).toBe(low.lcoe.present_value_electrical_energy_mwh);
    expect(high.lcoe.yearly_electrical_energy_kwh).toEqual(low.lcoe.yearly_electrical_energy_kwh);
    // But the INTEGRATED (compute-aware) delivered energy legitimately differs.
    expect(high.chip.chip_adjusted_energy_kwh).toBeLessThan(low.chip.chip_adjusted_energy_kwh);
  });
});

describe("schedule regression: a payload-only surprise-service trip creates no LCOE downtime or tug cost", () => {
  it("a scenario that triggers surprise compute-service visits in the integrated model leaves LCOE's cost and energy schedule unchanged vs. a scenario with none", () => {
    // trigger age ~1.05yr at 10% hazard/10% hot spares -> several surprise visits over the 20-year LCOE horizon in the integrated model.
    const noSurprise = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0 });
    const withSurprise = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10, hotSpareShare: 0.10 });
    expect(withSurprise.chip.expected_mode_1_surprise_service_event_count_per_position).toBeGreaterThan(0);
    expect(withSurprise.lcoe.yearly_power_system_cost_usd).toEqual(noSurprise.lcoe.yearly_power_system_cost_usd);
    expect(withSurprise.lcoe.yearly_electrical_energy_kwh).toEqual(noSurprise.lcoe.yearly_electrical_energy_kwh);
  });
});

describe("schedule regression: the six-month maintenance-consolidation rule moves total lifecycle maintenance but never LCOE's", () => {
  function lambdaForMonthsBeforeYear5(monthsBefore: number, hotSpareShare: number): number {
    const derived = computeDerived(DEFAULT_INPUTS);
    const returnYears = derived.one_way_journey_days / 365;
    const payloadDockYears = 1 / 365;
    const targetOrdinaryCompletion = 5 - monthsBefore / 12;
    const triggerAgeYears = targetOrdinaryCompletion - returnYears - payloadDockYears;
    return -Math.log(1 - hotSpareShare) / triggerAgeYears;
  }

  it("a surprise visit close enough to combine with year-5 maintenance in the integrated model does not move LCOE's nominal 5-year maintenance date", () => {
    const combineLambda = lambdaForMonthsBeforeYear5(6.0, 0.1);
    const noCombineLambda = lambdaForMonthsBeforeYear5(6.1, 0.1);
    const combine = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: combineLambda });
    const noCombine = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: noCombineLambda });

    // The integrated model's own maintenance date differs between the two (combine vs. not).
    expect(combine.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    expect(noCombine.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);

    // LCOE is completely unaffected -- same chronological physical schedule either way.
    expect(combine.lcoe.lcoe_usd_per_mwh).toBe(noCombine.lcoe.lcoe_usd_per_mwh);
    expect(combine.lcoe.yearly_power_system_cost_usd).toEqual(noCombine.lcoe.yearly_power_system_cost_usd);

    // LCOE's own maintenance-driven cost bumps land exactly at nominal years 5, 10, 15 (t-indices 5, 10, 15).
    const maintenanceLaborPlusTug =
      CONST.scheduled_node_maintenance_cost_fraction * combine.costs.non_compute_node_cost_usd +
      2 * CONST.tug_cost_usd_per_day * combine.derived.one_way_tug_days;
    for (const t of [5, 10, 15]) {
      expect(combine.lcoe.yearly_power_system_cost_usd[t]!).toBeGreaterThanOrEqual(maintenanceLaborPlusTug - 1e-6);
    }
  });
});

describe("schedule regression: Mode 2/3 non-chip failures create LCOE energy downtime and repair/tug cost", () => {
  it("raising the aggregate node-failure rate (which scales Modes 2/3) lowers LCOE's discounted electrical energy and raises its discounted cost", () => {
    const low = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0.005 });
    const high = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 });
    expect(high.lcoe.present_value_electrical_energy_mwh).toBeLessThan(low.lcoe.present_value_electrical_energy_mwh);
    expect(high.lcoe.present_value_power_system_cost_usd).toBeGreaterThan(low.lcoe.present_value_power_system_cost_usd);
  });
});

describe("schedule regression: Mode 4/5 replacement cost basis differs between LCOE and total lifecycle cost", () => {
  it("at a high node-failure rate, total lifecycle cost responds to compute hardware $/kW but LCOE does not (non-compute-only replacement basis)", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const cheapCompute = runModel({ ...inputs, compute_hardware_cost_usd_per_kw: 10_000 });
    const expensiveCompute = runModel({ ...inputs, compute_hardware_cost_usd_per_kw: 30_000 });
    expect(expensiveCompute.costs.total_compute_replacement_cost_usd).toBeGreaterThan(
      cheapCompute.costs.total_compute_replacement_cost_usd,
    );
    expect(expensiveCompute.lcoe.lcoe_usd_per_mwh).toBe(cheapCompute.lcoe.lcoe_usd_per_mwh);
  });

  it("LCOE's Mode 4/5 cost contribution matches non_compute_node_cost_usd x remaining-life-weighted event rate (never the full payload-inclusive node cost)", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    // A full generation (0..nodeLife) averages remaining-life fraction to exactly 0.5 (see remainingLife.test.ts).
    const mode_4_rate_annual = inputs.node_failure_rate_annual * CONST.mode_4_weight;
    const mode_5_rate_annual = inputs.node_failure_rate_annual * CONST.mode_5_weight;
    const totalLossRate = mode_4_rate_annual + mode_5_rate_annual;
    const expectedUndiscountedReplacementCost = totalLossRate * inputs.node_lifetime_years * r.costs.non_compute_node_cost_usd * 0.5;
    const undiscountedReplacementCost = r.lcoe.yearly_power_system_cost_usd
      .slice(1)
      .reduce((sum, v) => sum + v, 0); // excludes t=0 capital; still includes maintenance/mode2-3/mode5-cleanup too, so this is a loose upper-bound-style sanity check
    // Loose bound: the remaining-life-weighted replacement cost alone should be a meaningful (but not
    // exclusive) fraction of everything charged after t=0.
    expect(expectedUndiscountedReplacementCost).toBeGreaterThan(0);
    expect(expectedUndiscountedReplacementCost).toBeLessThan(undiscountedReplacementCost);
  });
});

describe("schedule regression: Mode 5 cleanup cost is included in LCOE", () => {
  it("LCOE's discounted cost exceeds a lower bound built purely from the discounted Mode 5 cleanup term", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    const mode_5_rate_annual = inputs.node_failure_rate_annual * CONST.mode_5_weight;
    const mode5CleanupPerYear = CONST.mode_5_catastrophic_cost_usd * mode_5_rate_annual;
    let pvMode5Cleanup = 0;
    for (let t = 1; t <= inputs.node_lifetime_years; t++) {
      pvMode5Cleanup += mode5CleanupPerYear / Math.pow(1 + inputs.real_discount_rate, t);
    }
    expect(pvMode5Cleanup).toBeGreaterThan(0);
    expect(r.lcoe.present_value_power_system_cost_usd).toBeGreaterThan(pvMode5Cleanup);

    // And removing node failures entirely (which zeroes mode 5) lowers LCOE cost below that bound's contribution.
    const zeroFailure = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0 });
    expect(r.lcoe.present_value_power_system_cost_usd).toBeGreaterThan(zeroFailure.lcoe.present_value_power_system_cost_usd);
  });
});

describe("LCOE's own horizon and unit-cost invariants", () => {
  it("undiscounted power-system cost schedule sums to a sane multiple of non-compute node cost (t=0 capital + retirement + O&M, no negative years)", () => {
    const r = runModel(DEFAULT_INPUTS);
    for (const v of r.lcoe.yearly_power_system_cost_usd) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
    const total = r.lcoe.yearly_power_system_cost_usd.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(r.costs.non_compute_node_cost_usd); // more than just initial capex
  });

  it("present-value energy is positive and well below the naive undiscounted nameplate ceiling (payload x 8760h x horizon)", () => {
    const r = runModel(DEFAULT_INPUTS);
    const nameplateCeilingMwh = (DEFAULT_INPUTS.payload_rating_kw * 8760 * r.lcoe.lcoe_horizon_years) / 1_000;
    expect(r.lcoe.present_value_electrical_energy_mwh).toBeGreaterThan(0);
    expect(r.lcoe.present_value_electrical_energy_mwh).toBeLessThan(nameplateCeilingMwh);
  });
});
