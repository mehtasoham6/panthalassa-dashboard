import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { computeDerived } from "../../src/model/derived.js";
import { computeNodeUnitCosts } from "../../src/model/nodeUnitCosts.js";
import { CONST } from "../../src/model/constants.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Hull structural-mass/cost model: cubic (geometric-volume) scaling off a
// single empirical Panthalassa design point (397 t at 23.0 m hull
// diameter), replacing the old 150t-at-20m linear relationship. Hull
// diameter now independently drives two unrelated things: the existing
// CWR/wave-capture calculation (unchanged) and this new cubic mass -> cost
// calculation. Neither uses the other as an input.
describe("hull structural mass and cost (cubic scaling off the 397t @ 23m design point)", () => {
  function unitAt(hull_diameter_m: number, overrides: Partial<typeof DEFAULT_INPUTS> = {}) {
    const inputs = { ...DEFAULT_INPUTS, hull_diameter_m, ...overrides };
    return computeNodeUnitCosts(inputs, computeDerived(inputs));
  }

  it("REGRESSION: at the 20 m default, structural mass ~261t, hull cost ~$522k, non-compute capital ~$702k, total node cost ~$5.702m", () => {
    const unit = unitAt(20);
    expect(unit.hull_steel_mass_tonnes).toBeCloseTo(261.034, 2);
    expect(unit.hull_cost_usd).toBeCloseTo(522_068, -2);
    expect(unit.non_compute_node_cost_usd).toBeCloseTo(702_068, -2);
    expect(unit.physical_node_cost_usd).toBeCloseTo(5_702_068, -2);
  });

  it("REGRESSION: at the 23 m empirical design point, structural mass is exactly 397t", () => {
    const unit = unitAt(23);
    expect(unit.hull_steel_mass_tonnes).toBeCloseTo(397, 9);
  });

  it("hull cost is derived (mass x $/tonne), never an independent input", () => {
    const unit = unitAt(20, { finished_hull_cost_usd_per_tonne: 3000 });
    expect(unit.hull_cost_usd).toBeCloseTo(unit.hull_steel_mass_tonnes * 3000, 6);
  });

  it("structural mass scales cubically with diameter, not linearly", () => {
    const at10 = unitAt(10).hull_steel_mass_tonnes;
    const at20 = unitAt(20).hull_steel_mass_tonnes;
    const at23 = unitAt(23).hull_steel_mass_tonnes;
    // Doubling diameter (10 -> 20) scales mass by ~2^3 = 8x, not 2x -- the
    // old linear model would have given exactly 2x here.
    expect(at20 / at10).toBeCloseTo(8, 1);
    expect(at20 / at10).not.toBeCloseTo(2, 0);
    const cubicPrediction = CONST.reference_hull_steel_mass_tonnes * Math.pow(20 / CONST.reference_hull_diameter_m, 3);
    expect(at20).toBeCloseTo(cubicPrediction, 6);
    expect(at23).toBeCloseTo(CONST.reference_hull_steel_mass_tonnes, 6);
  });

  it("changing structural-fabrication $/tonne changes hull cost but not structural mass or wave-capture output", () => {
    const cheap = unitAt(20, { finished_hull_cost_usd_per_tonne: 1500 });
    const expensive = unitAt(20, { finished_hull_cost_usd_per_tonne: 8000 });
    expect(cheap.hull_steel_mass_tonnes).toBeCloseTo(expensive.hull_steel_mass_tonnes, 9);
    expect(cheap.hull_cost_usd).toBeLessThan(expensive.hull_cost_usd);

    const dCheap = computeDerived({ ...DEFAULT_INPUTS, finished_hull_cost_usd_per_tonne: 1500 });
    const dExpensive = computeDerived({ ...DEFAULT_INPUTS, finished_hull_cost_usd_per_tonne: 8000 });
    expect(dCheap.capture_coefficient).toBeCloseTo(dExpensive.capture_coefficient, 12);
    expect(dCheap.effective_sea_park_cf).toBeCloseTo(dExpensive.effective_sea_park_cf, 12);
  });

  it("hull diameter still changes wave capture through the existing CWR relationship, independent of the new mass model", () => {
    const small = computeDerived({ ...DEFAULT_INPUTS, hull_diameter_m: 10 });
    const large = computeDerived({ ...DEFAULT_INPUTS, hull_diameter_m: 20 });
    expect(large.capture_coefficient).toBeGreaterThan(small.capture_coefficient);
    expect(large.effective_sea_park_cf).toBeGreaterThan(small.effective_sea_park_cf);
  });

  it("hull diameter propagates through lifecycle cost via BOTH channels at once (larger hull = more mass/cost AND more captured power)", () => {
    const small = runModel({ ...DEFAULT_INPUTS, hull_diameter_m: 10 });
    const large = runModel({ ...DEFAULT_INPUTS, hull_diameter_m: 20 });
    expect(small.costs.non_compute_node_cost_usd).toBeLessThan(large.costs.non_compute_node_cost_usd);
    expect(small.costs.total_node_fleet_cost_usd).not.toBe(large.costs.total_node_fleet_cost_usd);
  });

  it("hull mass is never used as an energy/power multiplier: the three descriptive resource metrics are untouched by fabrication cost, which only moves dollars", () => {
    const cheap = runModel({ ...DEFAULT_INPUTS, finished_hull_cost_usd_per_tonne: 1500 });
    const expensive = runModel({ ...DEFAULT_INPUTS, finished_hull_cost_usd_per_tonne: 8000 });
    expect(cheap.derived.resource_capacity_factor).toBe(expensive.derived.resource_capacity_factor);
    expect(cheap.derived.rated_power_availability).toBe(expensive.derived.rated_power_availability);
    expect(cheap.derived.keepalive_availability).toBe(expensive.derived.keepalive_availability);
    expect(cheap.derived.effective_sea_park_cf).toBe(expensive.derived.effective_sea_park_cf);
    // But fleet size/cost genuinely do move with fabrication cost (dollars only).
    expect(cheap.costs.total_node_fleet_cost_usd).toBeLessThan(expensive.costs.total_node_fleet_cost_usd);
  });

  it("no stale 150t-at-20m linear reference or old $300k/$410k hard-coded hull/non-compute values remain", () => {
    expect(CONST.reference_hull_steel_mass_tonnes).toBe(397);
    expect(CONST.reference_hull_diameter_m).toBe(23);
    const r = runModel(DEFAULT_INPUTS);
    expect(r.costs.non_compute_node_cost_usd).not.toBeCloseTo(410_000, -3);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(702_068, -2);
  });
});
