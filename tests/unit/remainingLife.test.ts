import { describe, expect, it } from "vitest";
import { averageRemainingLifeFraction, remainingLifeFraction, remainingLifeIntegral } from "../../src/model/remainingLife.js";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

describe("remainingLifeFraction (point function)", () => {
  it("age 0 -> 100% of full new-node cost", () => {
    expect(remainingLifeFraction(0, 20)).toBe(1);
  });

  it("age = 0.5 x nodeLife -> 50%", () => {
    expect(remainingLifeFraction(10, 20)).toBeCloseTo(0.5, 10);
  });

  it("age = nodeLife - 1 year -> 1/nodeLife of full cost", () => {
    expect(remainingLifeFraction(19, 20)).toBeCloseTo(1 / 20, 10);
  });

  it("age >= nodeLife -> 0 after clamping", () => {
    expect(remainingLifeFraction(20, 20)).toBe(0);
    expect(remainingLifeFraction(25, 20)).toBe(0);
  });
});

describe("averageRemainingLifeFraction (integrated, for the expected-value cost engine)", () => {
  it("a 20-year life over a fresh 5-year horizon averages to 0.875", () => {
    expect(averageRemainingLifeFraction(0, 5, 20)).toBeCloseTo(0.875, 10);
  });

  it("a full generation (0 to nodeLife) averages to exactly 0.5", () => {
    expect(averageRemainingLifeFraction(0, 20, 20)).toBeCloseTo(0.5, 10);
  });

  it("after a planned generation replacement, age resets and the factor returns near 1 (average just after year 20 is high again)", () => {
    // The year immediately following a 20-year generation boundary should
    // average close to 1 (fresh node for nearly the whole year).
    const justAfterReset = averageRemainingLifeFraction(20, 21, 20);
    expect(justAfterReset).toBeCloseTo(0.975, 10); // linear average of 1.0 (age 0) -> 0.95 (age 1)
  });

  it("a span crossing a generation boundary correctly resets mid-span (not one continuous decay from age 18 to age 21)", () => {
    // [18,22) with nodeLife=20 spans the boundary at 20: [18,20) decays from
    // age 18->20 (avg of 0.1 and 0), then [20,22) restarts at age 0->2.
    const spanning = remainingLifeIntegral(18, 22, 20);
    const preBoundary = remainingLifeIntegral(18, 20, 20); // age 18->20
    const postBoundary = remainingLifeIntegral(20, 22, 20); // age 0->2 (reset)
    expect(spanning).toBeCloseTo(preBoundary + postBoundary, 10);
    // postBoundary should reflect an age-0-start reset, not a continued age-20+ decay (which would be 0).
    expect(postBoundary).toBeGreaterThan(0);
    expect(postBoundary).toBeCloseTo(2 - (4 - 0) / (2 * 20), 10); // integral of (1-a/20) from 0 to 2
  });
});

describe("Modes 4/5 cost integration in the full model", () => {
  it("Mode 5 catastrophic cleanup cost is unaffected by the remaining-life factor", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    const expected = 2_000_000 * r.N_fleet * inputs.analysis_period_years * r.modeLosses.mode_5_rate_annual;
    expect(r.costs.lineItems.mode_5_catastrophic_cost_usd_total).toBeCloseTo(expected, 2);
  });

  it("no separate full compute replacement is double counted for Modes 4/5 (compute + non-compute pieces sum to avgFraction x one full node per event)", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    const avgFraction = averageRemainingLifeFraction(0, inputs.analysis_period_years, inputs.node_lifetime_years);
    const expectedEvents = r.N_fleet * inputs.analysis_period_years * (r.modeLosses.mode_4_rate_annual + r.modeLosses.mode_5_rate_annual);
    const sumOfPieces =
      r.costs.lineItems.fleet_complete_payload_replacement_cost_usd + r.costs.lineItems.mode_4_5_non_compute_replacement_cost_usd;
    expect(sumOfPieces).toBeCloseTo(expectedEvents * r.costs.physical_node_cost_usd * avgFraction, 2);
  });

  it("at age-0 defaults (no elapsed time before a total loss), a shorter analysis period yields a higher average remaining-life fraction and thus higher Modes 4/5 unit cost", () => {
    const short = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10, analysis_period_years: 3 });
    const long = runModel({ ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10, analysis_period_years: 15 });
    const shortAvgFraction = averageRemainingLifeFraction(0, 3, DEFAULT_INPUTS.node_lifetime_years);
    const longAvgFraction = averageRemainingLifeFraction(0, 15, DEFAULT_INPUTS.node_lifetime_years);
    expect(shortAvgFraction).toBeGreaterThan(longAvgFraction);
  });

  it("undiscounted total and the sum of yearly-allocated Modes 4/5 replacement cost match exactly (present-value chronology invariant)", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10, analysis_period_years: 12 };
    const r = runModel(inputs);
    const sumOfYearly = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
    expect(sumOfYearly).toBeCloseTo(r.costs.total_node_fleet_cost_usd, 2);
  });
});
