import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";
import { DEFAULT_TERRESTRIAL_INPUTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";

// CostPerWattBreakdown (the "All-in cost per target watt, by component" UI
// table) relies on each side's cost categories being genuine, independently
// discounted present values that sum exactly to the PV total -- not an
// approximation. These invariants hold by construction (linearity of
// discounting), but are checked here, including off-default inputs, as a
// regression guard against the sum silently drifting from the total.
describe("Cost-per-watt present-value category breakdown sums to the total", () => {
  it("ocean: nodes + chips + other opex + workload PV == present_value_total_node_fleet_cost_usd", () => {
    for (const inputs of [
      DEFAULT_INPUTS,
      { ...DEFAULT_INPUTS, analysis_period_years: 12, node_lifetime_years: 5, chip_failure_rate_annual: 0.03 },
    ]) {
      const r = runModel(inputs);
      const sum =
        r.presentValue.present_value_nodes_cost_usd +
        r.presentValue.present_value_chips_cost_usd +
        r.presentValue.present_value_other_opex_cost_usd +
        r.presentValue.present_value_workload_data_transfer_cost_usd;
      expect(sum).toBeCloseTo(r.presentValue.present_value_total_node_fleet_cost_usd, 4);
    }
  });

  it("ocean: lifecycle_cost_per_target_watt_usd == present_value_total_node_fleet_cost_usd / target watts", () => {
    const r = runModel(DEFAULT_INPUTS);
    const targetWatts = DEFAULT_INPUTS.target_capacity_gw * 1_000_000_000;
    expect(r.presentValue.lifecycle_cost_per_target_watt_usd).toBeCloseTo(
      r.presentValue.present_value_total_node_fleet_cost_usd / targetWatts,
      10,
    );
  });

  it("terrestrial: power plant + fuel + data center + chips + other opex + workload PV == present_value_total_lifecycle_cost_usd", () => {
    for (const inputs of [
      DEFAULT_TERRESTRIAL_INPUTS,
      { ...DEFAULT_TERRESTRIAL_INPUTS, analysis_period_years: 12, ccgt_economic_life_years: 8, chip_failure_rate_annual: 0.06 },
    ]) {
      const r = runTerrestrialModel(inputs);
      const sum =
        r.presentValue.present_value_power_plant_cost_usd +
        r.presentValue.present_value_fuel_cost_usd +
        r.presentValue.present_value_data_center_cost_usd +
        r.presentValue.present_value_chips_cost_usd +
        r.presentValue.present_value_other_opex_cost_usd +
        r.presentValue.present_value_workload_data_transfer_cost_usd;
      expect(sum).toBeCloseTo(r.presentValue.present_value_total_lifecycle_cost_usd, 4);
    }
  });

  it("terrestrial: lifecycle_cost_per_target_watt_usd == present_value_total_lifecycle_cost_usd / target watts", () => {
    const r = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);
    const targetWatts = DEFAULT_TERRESTRIAL_INPUTS.target_capacity_gw * 1_000_000_000;
    expect(r.costs.lifecycle_cost_per_target_watt_usd).toBeCloseTo(
      r.presentValue.present_value_total_lifecycle_cost_usd / targetWatts,
      6,
    );
  });

  it("terrestrial: power plant and data center categories are pure capital (no O&M/fuel/decommissioning mixed in)", () => {
    // buckets_undiscounted.power_system_usd bundles capex+fuel+O&M+decommissioning
    // together (the existing, unchanged bar-chart breakdown); the new PV
    // category is deliberately narrower -- verify it stays smaller.
    const r = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);
    expect(r.presentValue.present_value_power_plant_cost_usd).toBeLessThan(r.costs.buckets_undiscounted.power_system_usd);
    expect(r.presentValue.present_value_data_center_cost_usd).toBeLessThan(
      r.costs.buckets_undiscounted.data_center_facility_usd,
    );
  });
});
