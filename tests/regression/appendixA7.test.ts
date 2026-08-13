import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Appendix A.7 required regression checks, run against a spread of slider
// combinations (not just the two worked examples) since these are meant to
// hold as standing invariants of the model, not one-off coincidences.
//
// The two hard-coded totals below reflect the current model: revised Modes
// 2-5 failure shares (65/32/2/1%), a revised default aggregate node-failure
// rate (3%/year), the unified compute-health/service-schedule engine
// (continuous kW degradation, hot-spare-exhaustion trigger, fixed 5-year
// maintenance, no periodic payload-swap interval), workload data-transfer
// cost, the Copernicus WAVERYS sea-park wave-resource correction, and
// planned-generation capital allocation (the initial fleet is always charged
// in full; later planned replacement generations are charged only their
// share of a full generation's capital cost that falls within the analysis
// horizon -- see generationCapital.ts. At these defaults, node_generations
// == 1, so the allocation is a no-op and the total below is the full,
// unprorated fleet cost; see exampleA/B.test.ts, workloadCost.test.ts, and
// waverys.test.ts for the full breakdown).
describe("Appendix A.7 required regression checks", () => {
  it("default inputs: N_fleet == 5314 and rounded lifecycle cost == $29.54 billion", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.N_fleet).toBe(5314);
    expect(Math.round(r.costs.total_node_fleet_cost_usd / 1e7) / 100).toBeCloseTo(29.54, 2);
  });

  it("high chip-degradation-hazard inputs: N_fleet == 5473 and rounded lifecycle cost == $42.31 billion", () => {
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 });
    expect(r.N_fleet).toBe(5473);
    expect(Math.round(r.costs.total_node_fleet_cost_usd / 1e7) / 100).toBeCloseTo(42.31, 2);
  });

  const scenarios: { label: string; inputs: typeof DEFAULT_INPUTS }[] = [
    { label: "defaults", inputs: DEFAULT_INPUTS },
    { label: "high chip-degradation hazard", inputs: { ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 } },
    { label: "zero hot spares, high hazard", inputs: { ...DEFAULT_INPUTS, hotSpareShare: 0, chip_failure_rate_annual: 0.10 } },
    { label: "small hull, large payload", inputs: { ...DEFAULT_INPUTS, hull_diameter_m: 10, payload_rating_kw: 300 } },
    { label: "long distance, short node life", inputs: { ...DEFAULT_INPUTS, sea_park_distance_km: 4000, node_lifetime_years: 5, analysis_period_years: 12 } },
    { label: "max node-failure rate", inputs: { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 } },
    { label: "high hot spares, long horizon", inputs: { ...DEFAULT_INPUTS, hotSpareShare: 0.2, analysis_period_years: 15 } },
  ];

  for (const { label, inputs } of scenarios) {
    it(`compute + non-compute physical + non-compute maintenance/failure + workload data transfer == total lifecycle cost (unrounded) [${label}]`, () => {
      const r = runModel(inputs);
      const sum =
        r.costs.total_planned_physical_node_cost_usd +
        r.costs.total_compute_replacement_cost_usd +
        r.costs.total_non_compute_maintenance_failure_cost_usd +
        r.costs.total_workload_data_transfer_cost_usd;
      const tol = Math.max(0.01, 1e-9 * Math.abs(r.costs.total_node_fleet_cost_usd));
      expect(Math.abs(sum - r.costs.total_node_fleet_cost_usd)).toBeLessThan(tol);
    });

    it(`fleet-size minimality: (N_fleet-1)*slot < target <= N_fleet*slot [${label}]`, () => {
      const r = runModel(inputs);
      const slot = r.expected_delivered_energy_per_position_mw_years;
      expect((r.N_fleet - 1) * slot).toBeLessThan(r.target_energy_mw_years);
      expect(r.target_energy_mw_years).toBeLessThanOrEqual(r.N_fleet * slot);
    });

    it(`power_cap_kw invariant: min(payload, pto) == payload given pto_payload_multiplier > 1 [${label}]`, () => {
      const r = runModel(inputs);
      expect(r.derived.power_cap_kw).toBeCloseTo(inputs.payload_rating_kw, 6);
    });

    it(`annual cost buckets sum to the undiscounted total [${label}]`, () => {
      const r = runModel(inputs);
      const sum = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
      const tol = Math.max(0.01, 1e-9 * Math.abs(r.costs.total_node_fleet_cost_usd));
      expect(Math.abs(sum - r.costs.total_node_fleet_cost_usd)).toBeLessThan(tol);
    });
  }
});
