import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Worked Example A: all slider defaults, under the unified compute-health/
// service-schedule engine (no periodic payload-swap interval; continuous kW
// degradation; hot-spare-exhaustion trigger; fixed 5-year maintenance).
//
// At defaults, the trigger age (-ln(1-0.10)/0.01 ~= 10.54 years) is far
// beyond the 5-year analysis horizon, and the one fixed-maintenance boundary
// (year 5) coincides exactly with the horizon and is therefore excluded (a
// service completing exactly at Tend doesn't affect output within the
// period) -- so NO service visit occurs at all in this example. Output
// still declines continuously from chip degradation despite that.
describe("Worked Example A - all defaults (unified compute-health engine)", () => {
  const r = runModel(DEFAULT_INPUTS);

  it("no service visits occur within the 5-year horizon (trigger age ~10.54yr >> Tend; the year-5 fixed maintenance is boundary-excluded)", () => {
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(0);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(0);
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBe(0);
  });

  it("output still declines continuously from chip degradation, even with no service visit", () => {
    const avgKwPerNode = (r.expected_delivered_energy_per_position_mw_years / 5) * 1000;
    expect(avgKwPerNode).toBeLessThan(DEFAULT_INPUTS.payload_rating_kw);
    expect(avgKwPerNode).toBeCloseTo(194.584, 2);
  });

  it("chip-adjusted output ~= 8,544,232.528 kWh", () => {
    expect(r.chip.chip_adjusted_energy_kwh).toBeCloseTo(8_544_232.528, 0);
  });

  it("Modes 2-5 total loss ~= 21,464.145 kWh (unaffected by the compute-health engine change)", () => {
    expect(r.modeLosses.total_modes_2_5_loss_kwh).toBeCloseTo(21_464.145, 0);
  });

  it("delivered output per slot ~= 0.972919 MW-years", () => {
    expect(r.expected_delivered_energy_per_position_mw_years).toBeCloseTo(0.972919, 4);
  });

  it("N_fleet == 5140 (continuous degradation with no compensating early trip raises required fleet vs. the old economic-trigger engine)", () => {
    expect(r.N_fleet).toBe(5140);
  });

  it("per-node physical cost table (unaffected)", () => {
    expect(r.costs.physical_node_cost_usd).toBeCloseTo(3_410_000, 0);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(410_000, 0);
  });

  it("planned physical fleet cost ~= $17.5274 billion", () => {
    expect(r.costs.total_planned_physical_node_cost_usd).toBeCloseTo(17_527_400_000, -3);
  });

  it("compute replacement ~= $69.39 million (Modes 4/5 complete-payload replacement only -- no chip capacity has been replaced since no visit occurred)", () => {
    expect(r.costs.total_compute_replacement_cost_usd / 1e6).toBeCloseTo(69.39, 1);
  });

  it("non-compute maintenance/failure ~= $97.656 million", () => {
    expect(r.costs.total_non_compute_maintenance_failure_cost_usd / 1e6).toBeCloseTo(97.656, 1);
  });

  it("workload data-transfer cost ~= $591.395 million undiscounted", () => {
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.395, 0);
  });

  it("dashboard cost buckets (billions), including the workload data-transfer bucket", () => {
    expect(r.costs.buckets.compute_and_replacement_usd / 1e9).toBeCloseTo(15.489, 2);
    expect(r.costs.buckets.initial_non_compute_physical_usd / 1e9).toBeCloseTo(2.107, 2);
    expect(r.costs.buckets.non_compute_maintenance_failure_usd / 1e9).toBeCloseTo(0.098, 2);
    expect(r.costs.buckets.workload_data_transfer_usd / 1e9).toBeCloseTo(0.591, 2);
  });

  it("total undiscounted cost rounds to $18.29 billion", () => {
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(18.29, 1);
  });

  it("annual cost schedule", () => {
    const target = [17_535_966_666.67, 152_337_541.48, 151_159_749.04, 149_968_099.04, 148_788_306.15, 147_620_252.4];
    r.presentValue.yearly_cost_usd.forEach((v, i) => {
      expect(v).toBeCloseTo(target[i]!, -3);
    });
  });

  it("present-value total cost ~= $18.168 billion", () => {
    expect(r.presentValue.present_value_total_node_fleet_cost_usd / 1e9).toBeCloseTo(18.168, 2);
  });

  it("levelized delivered-compute cost ~= $491.71/MWh", () => {
    expect(r.presentValue.levelized_cost_of_delivered_compute_energy_usd_per_mwh).toBeCloseTo(491.71, 1);
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
});
