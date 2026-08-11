import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Workload data-transfer cost: recurring opex proportional to fleet-wide
// PRODUCTIVE delivered-compute energy (chip failures, Modes 2-5, and
// scheduled/unscheduled downtime already netted out) -- not installed
// nameplate capacity and not raw wave-energy generation.
describe("Workload data-transfer cost", () => {
  it("0.45 GB/kWh conversion: totalWorkloadDataGb == 0.45 * intensity * fleet-wide delivered energy (kWh)", () => {
    const r = runModel(DEFAULT_INPUTS);
    const fleetDeliveredEnergyKwh = r.N_fleet * r.delivered_energy_kwh;
    const expectedGb = 0.45 * DEFAULT_INPUTS.workloadBandwidthIntensityMbpsPerKw * fleetDeliveredEnergyKwh;
    expect(r.costs.total_workload_data_transferred_gb).toBeCloseTo(expectedGb, 2);
  });

  it("cost == data volume * $/GB", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.costs.total_workload_data_transfer_cost_usd).toBeCloseTo(
      r.costs.total_workload_data_transferred_gb * DEFAULT_INPUTS.dataTransferCostPerGb,
      2,
    );
  });

  it("at defaults: workload cost ~= $591.403 million undiscounted, ~$498.820 million present value", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.403, 0);
    expect(r.presentValue.present_value_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(498.820, 0);
  });

  it("workload data transfer never affects power-system LCOE (LCOE is compute/workload-agnostic; see lcoe.test.ts)", () => {
    const withWorkload = runModel(DEFAULT_INPUTS);
    const withoutWorkload = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: 0, dataTransferCostPerGb: 0 });
    expect(withWorkload.lcoe.lcoe_usd_per_mwh).toBe(withoutWorkload.lcoe.lcoe_usd_per_mwh);
  });

  it("workload cost is zero when either slider is zero, and scales linearly with each", () => {
    const zeroIntensity = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: 0 });
    const zeroCost = runModel({ ...DEFAULT_INPUTS, dataTransferCostPerGb: 0 });
    expect(zeroIntensity.costs.total_workload_data_transfer_cost_usd).toBe(0);
    expect(zeroCost.costs.total_workload_data_transfer_cost_usd).toBe(0);

    const base = runModel(DEFAULT_INPUTS);
    const doubleIntensity = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: DEFAULT_INPUTS.workloadBandwidthIntensityMbpsPerKw * 2 });
    const doubleCost = runModel({ ...DEFAULT_INPUTS, dataTransferCostPerGb: DEFAULT_INPUTS.dataTransferCostPerGb * 2 });
    // N_fleet can shift with sliders in general, but neither of these sliders
    // affects fleet sizing or delivered energy, so fleet-wide delivered
    // energy -- and therefore workload cost -- scales exactly linearly.
    expect(doubleIntensity.N_fleet).toBe(base.N_fleet);
    expect(doubleCost.N_fleet).toBe(base.N_fleet);
    expect(doubleIntensity.costs.total_workload_data_transfer_cost_usd).toBeCloseTo(2 * base.costs.total_workload_data_transfer_cost_usd, 2);
    expect(doubleCost.costs.total_workload_data_transfer_cost_usd).toBeCloseTo(2 * base.costs.total_workload_data_transfer_cost_usd, 2);
  });

  it("does not affect fleet sizing, N_fleet, or delivered energy (opex overlay only)", () => {
    const base = runModel(DEFAULT_INPUTS);
    const highWorkload = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: 0.10, dataTransferCostPerGb: 2.0 });
    expect(highWorkload.N_fleet).toBe(base.N_fleet);
    expect(highWorkload.expected_delivered_energy_per_position_mw_years).toBeCloseTo(base.expected_delivered_energy_per_position_mw_years, 10);
    expect(highWorkload.delivered_energy_kwh).toBeCloseTo(base.delivered_energy_kwh, 4);
  });

  it("is not charged against node capex: physical_node_cost_usd and total_planned_physical_node_cost_usd are unaffected", () => {
    const base = runModel(DEFAULT_INPUTS);
    const highWorkload = runModel({ ...DEFAULT_INPUTS, workloadBandwidthIntensityMbpsPerKw: 0.10, dataTransferCostPerGb: 2.0 });
    expect(highWorkload.costs.physical_node_cost_usd).toBeCloseTo(base.costs.physical_node_cost_usd, 6);
    expect(highWorkload.costs.total_planned_physical_node_cost_usd).toBeCloseTo(base.costs.total_planned_physical_node_cost_usd, 2);
  });

  it("total lifecycle cost and present value both include workload cost exactly once", () => {
    const r = runModel(DEFAULT_INPUTS);
    const withoutWorkload =
      r.costs.total_planned_physical_node_cost_usd +
      r.costs.total_compute_replacement_cost_usd +
      r.costs.total_non_compute_maintenance_failure_cost_usd;
    expect(r.costs.total_node_fleet_cost_usd - withoutWorkload).toBeCloseTo(r.costs.total_workload_data_transfer_cost_usd, 4);

    const sumOfYearly = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
    expect(sumOfYearly).toBeCloseTo(r.costs.total_node_fleet_cost_usd, 2);
  });
});
