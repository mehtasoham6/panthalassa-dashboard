import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Worked Example B: 10% chip-degradation hazard (default 10% hot spares).
// Trigger age = -ln(1-0.10)/0.10 ~= 1.054 years, well inside the 5-year
// horizon. The 4th standalone surprise visit's completion still falls
// within 6 months of the year-5 fixed-maintenance date, so it consolidates
// into one combined 7-day visit instead of a separate 5th trip -- that
// event-count/timing behavior is unaffected by the Copernicus WAVERYS
// sea-park resource correction (see exampleA.test.ts comment and
// waverys.test.ts's "service-event timing is independent" check); only
// delivered-energy and downstream fleet/cost totals move. As in Example A,
// there is only one planned generation at these defaults (5-year analysis,
// 20-year node life), so the planned-generation capital allocation (see
// generationCapital.ts) is a no-op and the totals below are the full,
// unprorated fleet cost.
describe("Worked Example B - 10% chip-degradation hazard (revised route/battery/consolidation/depreciation/WAVERYS resource)", () => {
  const inputs = { ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 };
  const r = runModel(inputs);

  it("four surprise visits occur, the last one consolidated with the year-5 fixed maintenance", () => {
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(4);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    // Consolidated: 4 trips total, not 5 (surprise + separate maintenance).
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(4);
  });

  it("expected failed capacity replaced across all visits ~= 85.967 kW (unaffected by the wave-resource correction -- a pure age/hazard quantity)", () => {
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(85.967, 2);
  });

  it("chip-adjusted output ~= 8,023,873.165 kWh", () => {
    expect(r.chip.chip_adjusted_energy_kwh).toBeCloseTo(8_023_873.165, 0);
  });

  it("Modes 2-5 total loss ~= 20,025.413 kWh (same as Example A -- unaffected by chip hazard)", () => {
    expect(r.modeLosses.total_modes_2_5_loss_kwh).toBeCloseTo(20_025.413, 0);
  });

  it("delivered output per slot ~= 0.913681 MW-years", () => {
    expect(r.expected_delivered_energy_per_position_mw_years).toBeCloseTo(0.913681, 4);
  });

  it("N_fleet == 5473", () => {
    expect(r.N_fleet).toBe(5473);
  });

  it("planned physical fleet cost ~= $29.60893 billion", () => {
    expect(r.costs.total_planned_physical_node_cost_usd / 1e9).toBeCloseTo(29.60893, 3);
  });

  it("compute replacement ~= $11.87017 billion", () => {
    expect(r.costs.total_compute_replacement_cost_usd / 1e9).toBeCloseTo(11.87017, 3);
  });

  it("non-compute maintenance/failure ~= $243.011 million", () => {
    expect(r.costs.total_non_compute_maintenance_failure_cost_usd / 1e6).toBeCloseTo(243.011, 1);
  });

  it("workload data-transfer cost ~= $591.368 million undiscounted (~same as Example A -- both fleets size to ~the same target)", () => {
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.368, 0);
  });

  it("dashboard cost buckets (billions), initial generation charged in full (only one planned generation at these defaults)", () => {
    expect(r.costs.buckets.compute_and_replacement_usd / 1e9).toBeCloseTo(39.235, 2);
    expect(r.costs.buckets.initial_non_compute_physical_usd / 1e9).toBeCloseTo(2.244, 2);
    expect(r.costs.buckets.non_compute_maintenance_failure_usd / 1e9).toBeCloseTo(0.243, 2);
    expect(r.costs.buckets.workload_data_transfer_usd / 1e9).toBeCloseTo(0.591, 2);
  });

  it("no residual/terminal-value metric exists anywhere in the costs result", () => {
    expect(Object.keys(r.costs)).not.toContain("terminal_residual_value_usd");
    expect(Object.keys(r.costs.lineItems)).not.toContain("terminal_residual_value_usd");
  });

  it("undiscounted lifecycle cost rounds to $42.31 billion (Appendix A.7 hard check)", () => {
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(42.31, 1);
  });

  it("present-value lifecycle cost ~= $40.010 billion", () => {
    expect(r.presentValue.present_value_total_node_fleet_cost_usd / 1e9).toBeCloseTo(40.010, 2);
  });

  it("power-system LCOE is identical to Example A's -- chip_failure_rate_annual is compute-only and never touches LCOE", () => {
    const a = runModel(DEFAULT_INPUTS);
    expect(r.lcoe.lcoe_usd_per_mwh).toBe(a.lcoe.lcoe_usd_per_mwh);
  });

  it("cost buckets sum to the total (unrounded, exact identity)", () => {
    const sum =
      r.costs.buckets.compute_and_replacement_usd +
      r.costs.buckets.initial_non_compute_physical_usd +
      r.costs.buckets.non_compute_maintenance_failure_usd +
      r.costs.buckets.workload_data_transfer_usd;
    expect(sum).toBeCloseTo(r.costs.total_node_fleet_cost_usd, 4);
  });

  it("yearly cost buckets sum to the undiscounted total (annual allocation invariant)", () => {
    const sum = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
    const tol = Math.max(0.01, 1e-10 * Math.abs(r.costs.total_node_fleet_cost_usd));
    expect(Math.abs(sum - r.costs.total_node_fleet_cost_usd)).toBeLessThan(tol);
  });

  it("fleet-size minimality", () => {
    const slot = r.expected_delivered_energy_per_position_mw_years;
    expect((r.N_fleet - 1) * slot).toBeLessThan(r.target_energy_mw_years);
    expect(r.target_energy_mw_years).toBeLessThanOrEqual(r.N_fleet * slot);
  });

  it("Example B requires more nodes and costs more than Example A", () => {
    const a = runModel(DEFAULT_INPUTS);
    expect(r.N_fleet).toBeGreaterThan(a.N_fleet);
    expect(r.costs.total_node_fleet_cost_usd).toBeGreaterThan(a.costs.total_node_fleet_cost_usd);
  });
});
