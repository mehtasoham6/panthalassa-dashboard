import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";
import { computeCosts } from "../../src/model/costs.js";
import { generationCapitalFraction, computeGenerationCapitalEquivalents } from "../../src/model/generationCapital.js";
import { averageRemainingLifeFraction } from "../../src/model/remainingLife.js";
import type { ChipFailureResult, ModelResult } from "../../src/model/types.js";

// Replaces the removed terminal-residual-value approach (see the deleted
// tests/unit/terminalResidualValue.test.ts). The initial fleet (generation
// 0) is always charged in full for the "Total lifecycle cost" metric; later
// planned replacement generations are charged only their share of a full
// generation's capital cost that falls within the analysis horizon -- see
// generationCapital.ts. There is no residual/terminal-value credit anywhere.

const ZERO_CHIP: ChipFailureResult = {
  chip_adjusted_energy_kwh: 0,
  expected_mode_1_surprise_service_event_count_per_position: 0,
  scheduled_node_maintenance_event_count_per_position: 0,
  expected_failed_capacity_kw_replaced_per_position: 0,
  expected_mode_1_physical_tug_round_trips_per_position: 0,
  yearly_delivered_energy_kwh: [],
  yearly_failed_capacity_kw_replaced: [],
  yearly_surprise_service_events: [],
  yearly_scheduled_full_maintenance_events: [],
  yearly_mode_1_tug_round_trips: [],
};

const ZERO_MODE_LOSSES: ModelResult["modeLosses"] = {
  mode_2_loss_kwh: 0,
  mode_3_loss_kwh: 0,
  mode_4_loss_kwh: 0,
  mode_5_loss_kwh: 0,
  total_modes_2_5_loss_kwh: 0,
  mode_2_rate_annual: 0,
  mode_3_rate_annual: 0,
  mode_4_rate_annual: 0,
  mode_5_rate_annual: 0,
};

// A real, self-consistent `derived` object (node_lifetime_years = 20) reused
// across computeCosts() calls below. computeCosts never reads any T-dependent
// field off `derived` (only one_way_tug_days and, via computeNodeUnitCosts,
// pto_rating_kw), so it's safe to hold this fixed while varying
// analysis_period_years directly on the `inputs` passed to computeCosts --
// this is what lets fractional-year cases (19.9, 20.1, 40.1) be tested
// without going through runModel(), which requires an integer
// analysis_period_years (fixed-size year-bucket arrays elsewhere in the
// model).
const L = 20;
const baseInputs = { ...DEFAULT_INPUTS, node_lifetime_years: L };
const derived20 = runModel({ ...baseInputs, analysis_period_years: L }).derived;
const N_FLEET = 1000;

function costsAt(analysisPeriodYears: number, nodeGenerations: number) {
  const inputs = { ...baseInputs, analysis_period_years: analysisPeriodYears };
  return computeCosts(inputs, derived20, ZERO_CHIP, ZERO_MODE_LOSSES, N_FLEET, nodeGenerations, 0);
}

describe("generationCapitalFraction / computeGenerationCapitalEquivalents (pure allocation math)", () => {
  it("generation 0 (initial fleet) is always 1, regardless of how short the horizon is", () => {
    expect(generationCapitalFraction(0, 0.001, L)).toBe(1);
    expect(generationCapitalFraction(0, 5, L)).toBe(1);
    expect(generationCapitalFraction(0, 19.9, L)).toBe(1);
    expect(generationCapitalFraction(0, 1000, L)).toBe(1);
  });

  it("boundary table from spec (nodeLife = 20)", () => {
    const cases: [T: number, nodeGenerations: number, expected: number][] = [
      [5, 1, 1.0],
      [19.9, 1, 1.0],
      [20.0, 1, 1.0],
      [20.1, 2, 1.005],
      [25, 2, 1.25],
      [40, 2, 2.0],
      [40.1, 3, 2.005],
    ];
    for (const [T, nodeGenerations, expected] of cases) {
      expect(computeGenerationCapitalEquivalents(nodeGenerations, T, L)).toBeCloseTo(expected, 6);
    }
  });

  it("equals max(1, T/L) when every planned generation's capital is fully used or the horizon covers exactly whole generations", () => {
    for (const T of [5, 20, 40, 60]) {
      const nodeGenerations = Math.max(1, Math.ceil(T / L));
      expect(computeGenerationCapitalEquivalents(nodeGenerations, T, L)).toBeCloseTo(Math.max(1, T / L), 10);
    }
  });

  it("later-generation fractions are clamped to [0, 1]", () => {
    expect(generationCapitalFraction(1, 20, L)).toBe(0); // horizon ends exactly when gen 1 would start
    expect(generationCapitalFraction(1, 0, L)).toBe(0);
    expect(generationCapitalFraction(1, 100, L)).toBe(1); // fully used
  });
});

describe("computeCosts: planned-generation capital allocation", () => {
  it("T=5 (< nodeLife): generation 0 charged at 100%, no generation 2 purchased", () => {
    const r = costsAt(5, 1);
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(r.physical_node_cost_usd * N_FLEET, 6);
  });

  it("T=19.9: still exactly 1 generation-equivalent (no early charge for the next generation)", () => {
    const r = costsAt(19.9, 1);
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(r.physical_node_cost_usd * N_FLEET, 6);
  });

  it("T=20.0: generation 2 fraction is 0 -- it is not purchased or charged yet", () => {
    const r = costsAt(20.0, 1);
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(r.physical_node_cost_usd * N_FLEET, 6);
  });

  it("T=20.1: generation 2 fraction ~= 0.005 of a full generation is charged", () => {
    const r = costsAt(20.1, 2);
    const expected = r.physical_node_cost_usd * N_FLEET * 1.005;
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(expected, 0);
  });

  it("T=25: generation 2 fraction = 0.25", () => {
    const r = costsAt(25, 2);
    const expected = r.physical_node_cost_usd * N_FLEET * 1.25;
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(expected, 0);
  });

  it("T=40: generations 1 and 2 both at 100%, no generation 3 purchased", () => {
    const r = costsAt(40, 2);
    const expected = r.physical_node_cost_usd * N_FLEET * 2.0;
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(expected, 0);
  });

  it("T=40.1: generation 3 fraction ~= 0.005", () => {
    const r = costsAt(40.1, 3);
    const expected = r.physical_node_cost_usd * N_FLEET * 2.005;
    expect(r.total_planned_physical_node_cost_usd).toBeCloseTo(expected, 0);
  });

  it("every later-generation capital category (compute + non-compute) is scaled by the same fraction", () => {
    const r = costsAt(25, 2); // generation-equivalents = 1.25
    expect(r.lineItems.compute_hardware_capex_usd).toBeCloseTo(
      (r.physical_node_cost_usd - r.non_compute_node_cost_usd) * N_FLEET * 1.25,
      0,
    );
    expect(r.buckets.initial_non_compute_physical_usd).toBeCloseTo(r.non_compute_node_cost_usd * N_FLEET * 1.25, 0);
    // The two capital buckets/line items always sum back to total_planned_physical_node_cost_usd
    // (plus, for compute_and_replacement_usd, the separate Mode 4/5 replacement term, zero here).
    expect(r.buckets.initial_non_compute_physical_usd + r.lineItems.compute_hardware_capex_usd).toBeCloseTo(
      r.total_planned_physical_node_cost_usd,
      0,
    );
  });

  it("operating/logistics costs (deployment tug leg) are NOT prorated -- they track the integer generation count, not the fraction", () => {
    // node_generations goes from 1 (T=19.9, T=20.0) to 2 (T=20.1) -- a discrete
    // purchase event -- but the tug leg for generation 2 is a full leg cost
    // even though only 0.5% of that generation's capital is charged.
    const at19_9 = costsAt(19.9, 1);
    const at20_0 = costsAt(20.0, 1);
    const at20_1 = costsAt(20.1, 2);
    expect(at20_0.lineItems.normal_tug_cost_usd).toBeCloseTo(at19_9.lineItems.normal_tug_cost_usd, 6);
    expect(at20_1.lineItems.normal_tug_cost_usd).toBeGreaterThan(at20_0.lineItems.normal_tug_cost_usd);
    // The extra tug leg is a FULL leg, not 0.5% of one.
    const oneLegCost = at20_1.lineItems.normal_tug_cost_usd - at20_0.lineItems.normal_tug_cost_usd;
    expect(oneLegCost).toBeGreaterThan(at20_0.lineItems.normal_tug_cost_usd * 0.5); // nowhere near a 0.5% sliver
  });

  it("retirement cost is charged only at actual end-of-life completion, not prorated by the fraction", () => {
    expect(costsAt(19.9, 1).lineItems.node_retirement_cost_usd_total).toBe(0);
    expect(costsAt(20.0, 1).lineItems.node_retirement_cost_usd_total).toBeGreaterThan(0);
    // T=25: generation 1 (age 25) has retired, generation 2 (age 5) has not --
    // exactly one retirement charge, same as at T=20.
    expect(costsAt(25, 2).lineItems.node_retirement_cost_usd_total).toBeCloseTo(
      costsAt(20.0, 1).lineItems.node_retirement_cost_usd_total,
      0,
    );
    // T=40: both generations have completed their 20-year life -- two retirement charges.
    expect(costsAt(40, 2).lineItems.node_retirement_cost_usd_total).toBeCloseTo(
      2 * costsAt(20.0, 1).lineItems.node_retirement_cost_usd_total,
      0,
    );
  });
});

describe("Mode 4/5 economics: unchanged by the generation-capital-allocation rework", () => {
  it("fleet_complete_payload_replacement_cost_usd still uses averageRemainingLifeFraction(0, T, L) exactly, independent of node_generations proration", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.1 };
    const r = runModel(inputs);
    const expectedTotalLossEventsFleet =
      r.N_fleet * inputs.analysis_period_years * (r.modeLosses.mode_4_rate_annual + r.modeLosses.mode_5_rate_annual);
    const avgFrac = averageRemainingLifeFraction(0, inputs.analysis_period_years, inputs.node_lifetime_years);
    const computeHardwareCostUsd = inputs.payload_rating_kw * inputs.compute_hardware_cost_usd_per_kw;
    const expected = expectedTotalLossEventsFleet * computeHardwareCostUsd * avgFrac;
    expect(r.costs.lineItems.fleet_complete_payload_replacement_cost_usd).toBeCloseTo(expected, 0);
  });
});

describe("Power-system LCOE: unaffected by analysis_period_years", () => {
  it("LCOE is identical across very different analysis periods (same other inputs)", () => {
    const periods = [5, 19, 21, 25, 40];
    const lcoes = periods.map((analysis_period_years) => runModel({ ...DEFAULT_INPUTS, analysis_period_years }).lcoe.lcoe_usd_per_mwh);
    for (const l of lcoes) {
      expect(l).toBe(lcoes[0]);
    }
  });
});

describe("No residual/terminal-value metric exists anywhere in the model result", () => {
  it("costs and costs.lineItems have no residual/terminal-value field", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(Object.keys(r.costs)).not.toContain("terminal_residual_value_usd");
    expect(Object.keys(r.costs.lineItems)).not.toContain("terminal_residual_value_usd");
    expect(Object.keys(r.costs.buckets)).not.toContain("terminal_residual_value_usd");
  });

  it("default 5-year total lifecycle cost matches the pre-proration-era (pre-terminal-residual) baseline", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.N_fleet).toBe(5314);
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(29.54, 1);
  });
});

describe("Focused regression: no near-full-generation cliff around a node-life boundary", () => {
  // runModel() requires an integer analysis_period_years (fixed-size yearly
  // arrays), so 19/20/21 stand in for the spec's 19.9/20.0/20.1 example --
  // still exercises the same boundary, one generation-life (20 years) apart.
  const r19 = runModel({ ...DEFAULT_INPUTS, analysis_period_years: 19 });
  const r20 = runModel({ ...DEFAULT_INPUTS, analysis_period_years: 20 });
  const r21 = runModel({ ...DEFAULT_INPUTS, analysis_period_years: 21 });

  it("node_generations only increments from 1 to 2 crossing T=20 -> T=21, not before", () => {
    expect(r19.node_generations).toBe(1);
    expect(r20.node_generations).toBe(1);
    expect(r21.node_generations).toBe(2);
  });

  it("19 -> 20 (no new generation, but real retirement + one more year of opex) is a small, genuine step", () => {
    const delta = r20.costs.total_node_fleet_cost_usd - r19.costs.total_node_fleet_cost_usd;
    // One more year of ops/failure/workload cost plus a real retirement
    // charge -- small relative to a full generation's capital cost, and NOT zero.
    expect(delta).toBeGreaterThan(0);
    expect(delta / r19.costs.total_planned_physical_node_cost_usd).toBeLessThan(0.05);
  });

  it("20 -> 21 (a new generation begins, at a ~1/20 fraction) is NOT a near-full-generation jump", () => {
    const delta = r21.costs.total_node_fleet_cost_usd - r20.costs.total_node_fleet_cost_usd;
    // A full second generation's capital would be roughly one more
    // total_planned_physical_node_cost_usd (~$18B) -- the actual jump should
    // be nowhere near that: ~1/20 of a generation's capital, plus one
    // deployment tug leg, plus one year of ops cost.
    expect(delta).toBeLessThan(0.15 * r20.costs.total_planned_physical_node_cost_usd);
    expect(delta).toBeGreaterThan(0); // still a real, non-cosmetically-smoothed increase
  });

  it("present value shows no artificial dip or credit at the end of the horizon", () => {
    for (const r of [r19, r20, r21]) {
      const last = r.presentValue.yearly_cost_usd[r.presentValue.yearly_cost_usd.length - 1]!;
      expect(last).toBeGreaterThan(0);
    }
  });

  it("LCOE is unaffected across this boundary", () => {
    expect(r19.lcoe.lcoe_usd_per_mwh).toBe(r20.lcoe.lcoe_usd_per_mwh);
    expect(r20.lcoe.lcoe_usd_per_mwh).toBe(r21.lcoe.lcoe_usd_per_mwh);
  });

  it("yearly cost buckets still sum to the undiscounted total at every point across the boundary", () => {
    for (const r of [r19, r20, r21]) {
      const sum = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
      const tol = Math.max(0.01, 1e-9 * Math.abs(r.costs.total_node_fleet_cost_usd));
      expect(Math.abs(sum - r.costs.total_node_fleet_cost_usd)).toBeLessThan(tol);
    }
  });
});
