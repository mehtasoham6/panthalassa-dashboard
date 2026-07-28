import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Worked Example B: 10% chip-degradation hazard (default 10% hot spares).
// Trigger age = -ln(1-0.10)/0.10 ~= 1.054 years, well inside the 5-year
// horizon, so surprise service trips actually occur (none of them close
// enough to the year-5 fixed maintenance to merge).
describe("Worked Example B - 10% chip-degradation hazard (unified compute-health engine)", () => {
  const inputs = { ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.10 };
  const r = runModel(inputs);

  it("four surprise service visits occur, no fixed maintenance (all well before year 5)", () => {
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(4);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(4);
  });

  it("expected failed capacity replaced across all visits ~= 85.967 kW", () => {
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(85.967, 2);
  });

  it("chip-adjusted output ~= 8,285,161.377 kWh", () => {
    expect(r.chip.chip_adjusted_energy_kwh).toBeCloseTo(8_285_161.377, 0);
  });

  it("Modes 2-5 total loss ~= 21,464.145 kWh (unaffected by chip hazard)", () => {
    expect(r.modeLosses.total_modes_2_5_loss_kwh).toBeCloseTo(21_464.145, 0);
  });

  it("delivered output per slot ~= 0.943344 MW-years", () => {
    expect(r.expected_delivered_energy_per_position_mw_years).toBeCloseTo(0.943344, 4);
  });

  it("N_fleet == 5301", () => {
    expect(r.N_fleet).toBe(5301);
  });

  it("planned physical fleet cost ~= $18.07641 billion", () => {
    expect(r.costs.total_planned_physical_node_cost_usd / 1e9).toBeCloseTo(18.07641, 3);
  });

  it("compute replacement ~= $6.90722 billion", () => {
    expect(r.costs.total_compute_replacement_cost_usd / 1e9).toBeCloseTo(6.90722, 3);
  });

  it("non-compute maintenance/failure ~= $171.395 million", () => {
    expect(r.costs.total_non_compute_maintenance_failure_cost_usd / 1e6).toBeCloseTo(171.395, 1);
  });

  it("workload data-transfer cost ~= $591.379 million undiscounted (~same as Example A -- both fleets size to ~the same 5,000 MW-year target)", () => {
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.379, 0);
  });

  it("dashboard cost buckets (billions)", () => {
    expect(r.costs.buckets.compute_and_replacement_usd / 1e9).toBeCloseTo(22.81, 2);
    expect(r.costs.buckets.initial_non_compute_physical_usd / 1e9).toBeCloseTo(2.173, 2);
    expect(r.costs.buckets.non_compute_maintenance_failure_usd / 1e9).toBeCloseTo(0.171, 2);
    expect(r.costs.buckets.workload_data_transfer_usd / 1e9).toBeCloseTo(0.591, 2);
  });

  it("total undiscounted cost rounds to $25.75 billion (Appendix A.7 hard check)", () => {
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(25.75, 1);
  });

  it("present-value total cost ~= $24.365 billion", () => {
    expect(r.presentValue.present_value_total_node_fleet_cost_usd / 1e9).toBeCloseTo(24.365, 2);
  });

  it("levelized delivered-compute cost ~= $660.03/MWh", () => {
    expect(r.presentValue.levelized_cost_of_delivered_compute_energy_usd_per_mwh).toBeCloseTo(660.03, 1);
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
