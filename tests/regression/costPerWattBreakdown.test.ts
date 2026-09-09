import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";
import { DEFAULT_TERRESTRIAL_INPUTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";

// CostPerWattBreakdown (the "All-in cost per target watt, by component" UI
// table) relies on each side's cost categories being genuine, independently
// discounted present values that sum exactly to the PV total -- not an
// approximation. These invariants hold by construction (linearity of
// discounting), but are checked here, including off-default inputs, as a
// regression guard against the sum silently drifting from the total. Each
// row is a full total-cost-of-ownership for that component (capex + its own
// PV'd operating costs) -- there is deliberately no "other opex" category,
// since every recurring cost already belongs to one of the rows shown.
describe("Cost-per-watt present-value category breakdown sums to the total", () => {
  it("ocean: nodes + chips + workload PV == present_value_total_node_fleet_cost_usd", () => {
    for (const inputs of [
      DEFAULT_INPUTS,
      { ...DEFAULT_INPUTS, analysis_period_years: 12, node_lifetime_years: 5, chip_failure_rate_annual: 0.03 },
    ]) {
      const r = runModel(inputs);
      const sum =
        r.presentValue.present_value_nodes_cost_usd +
        r.presentValue.present_value_chips_cost_usd +
        r.presentValue.present_value_workload_data_transfer_cost_usd;
      expect(sum).toBeCloseTo(r.presentValue.present_value_total_node_fleet_cost_usd, 4);
    }
  });

  it("ocean: no separate 'other opex' field exists on the present-value result", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(Object.keys(r.presentValue)).not.toContain("present_value_other_opex_cost_usd");
  });

  it("ocean: lifecycle_cost_per_target_watt_usd == present_value_total_node_fleet_cost_usd / target watts", () => {
    const r = runModel(DEFAULT_INPUTS);
    const targetWatts = DEFAULT_INPUTS.target_capacity_gw * 1_000_000_000;
    expect(r.presentValue.lifecycle_cost_per_target_watt_usd).toBeCloseTo(
      r.presentValue.present_value_total_node_fleet_cost_usd / targetWatts,
      10,
    );
  });

  it("terrestrial: power plant + fuel + data center + chips + workload PV == present_value_total_lifecycle_cost_usd", () => {
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
        r.presentValue.present_value_workload_data_transfer_cost_usd;
      expect(sum).toBeCloseTo(r.presentValue.present_value_total_lifecycle_cost_usd, 4);
    }
  });

  it("terrestrial: no separate 'other opex' field exists on the present-value result", () => {
    const r = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);
    expect(Object.keys(r.presentValue)).not.toContain("present_value_other_opex_cost_usd");
  });

  it("terrestrial: lifecycle_cost_per_target_watt_usd == present_value_total_lifecycle_cost_usd / target watts", () => {
    const r = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);
    const targetWatts = DEFAULT_TERRESTRIAL_INPUTS.target_capacity_gw * 1_000_000_000;
    expect(r.costs.lifecycle_cost_per_target_watt_usd).toBeCloseTo(
      r.presentValue.present_value_total_lifecycle_cost_usd / targetWatts,
      6,
    );
  });

  it("terrestrial: power plant and data center categories are full TCO for that asset (capex PLUS O&M/decommissioning), not capex alone", () => {
    const r = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);
    const nameplateKw = r.capacity.power_plant_nameplate_capacity_mw * 1_000;
    const powerPlantCapexOnly = nameplateKw * DEFAULT_TERRESTRIAL_INPUTS.ccgt_capex_usd_per_kw;
    expect(r.presentValue.present_value_power_plant_cost_usd).toBeGreaterThan(powerPlantCapexOnly);

    const targetItW = r.capacity.installed_compute_capacity_mw * 1_000 * 1_000;
    const facilityCapexOnly = targetItW * DEFAULT_TERRESTRIAL_INPUTS.facility_capex_usd_per_it_watt;
    expect(r.presentValue.present_value_data_center_cost_usd).toBeGreaterThan(facilityCapexOnly);
  });

  it("ocean: the nodes category is more than its non-compute capex alone (deployment logistics, maintenance, and failure/retirement are folded in too)", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.presentValue.present_value_nodes_cost_usd).toBeGreaterThan(r.costs.non_compute_node_cost_usd * r.N_fleet);
  });
});
