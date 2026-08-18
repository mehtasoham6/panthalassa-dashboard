import { describe, expect, it } from "vitest";
import { DEFAULT_TERRESTRIAL_INPUTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";
import lockedReference from "../../reference-outputs/refined-default.json";

describe("refined terrestrial reference case", () => {
  const result = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);

  it("meets a 1 GW average IT target and sizes generation for PUE and availability", () => {
    expect(result.capacity.target_average_delivered_compute_mw).toBe(1_000);
    expect(result.capacity.installed_compute_capacity_mw).toBe(1_000);
    expect(result.capacity.average_facility_electrical_load_mw).toBe(1_200);
    expect(result.capacity.ccgt_nameplate_capacity_mw).toBeCloseTo(1_411.764705882353, 9);
    expect(result.capacity.generation_nameplate_margin_over_average_load).toBeCloseTo(1 / 0.85 - 1, 12);
  });

  it("has a closed energy and fuel balance", () => {
    expect(result.energy.annual_delivered_compute_mwh).toBe(8_760_000);
    expect(result.energy.annual_generated_electricity_mwh).toBe(10_512_000);
    expect(result.energy.annual_generated_electricity_mwh).toBe(
      result.energy.annual_delivered_compute_mwh * DEFAULT_TERRESTRIAL_INPUTS.pue,
    );
    expect(result.energy.annual_natural_gas_mmbtu).toBe(67_276_800);
    expect(result.energy.analysis_period_natural_gas_bcf).toBeCloseTo(324.3818707810993, 8);
  });

  it("includes compute hardware in the comprehensive total", () => {
    expect(result.costs.initial.compute_hardware_capex_usd).toBe(25_000_000_000);
    expect(result.costs.initial.facility_capex_usd).toBe(12_500_000_000);
    expect(result.costs.initial.ccgt_capex_usd).toBeCloseTo(3_247_058_823.529412, 4);
    expect(result.costs.annual_steady_state.compute_failure_replacement_usd).toBe(1_000_000_000);
  });

  it("matches the locked reference totals (5.5% terrestrial real discount rate, 4%/yr chip failure rate)", () => {
    expect(result.energy.total_workload_data_transferred_gb).toBe(591_300_000);
    expect(result.costs.annual_steady_state.total_annual_recurring_usd).toBeCloseTo(1_401_252_754.117647, 4);
    expect(result.costs.total_lifecycle_cost_usd).toBeCloseTo(47_753_322_594.11764, 3);
    expect(result.presentValue.present_value_total_lifecycle_cost_usd).toBeCloseTo(46_730_806_705.856514, 3);
    expect(result.costs.lifecycle_cost_per_target_watt_usd).toBeCloseTo(47.75332259411764, 10);
    expect(result.lcoe.lcoe_usd_per_mwh).toBeCloseTo(53.081993046631986, 10);
  });

  it("keeps the portable JSON reference synchronized with the executable model", () => {
    expect(lockedReference.outputs).toEqual({
      targetAverageDeliveredComputeMw: result.capacity.target_average_delivered_compute_mw,
      averageFacilityElectricalLoadMw: result.capacity.average_facility_electrical_load_mw,
      ccgtNameplateCapacityMw: result.capacity.ccgt_nameplate_capacity_mw,
      annualDeliveredComputeMWh: result.energy.annual_delivered_compute_mwh,
      annualGeneratedElectricityMWh: result.energy.annual_generated_electricity_mwh,
      annualNaturalGasMMBtu: result.energy.annual_natural_gas_mmbtu,
      fiveYearNaturalGasBcf: result.energy.analysis_period_natural_gas_bcf,
      initialCcgtCapexUsd: result.costs.initial.ccgt_capex_usd,
      initialFacilityCapexUsd: result.costs.initial.facility_capex_usd,
      initialComputeCapexUsd: result.costs.initial.compute_hardware_capex_usd,
      annualRecurringCostUsd: result.costs.annual_steady_state.total_annual_recurring_usd,
      totalLifecycleCostUsd: result.costs.total_lifecycle_cost_usd,
      presentValueLifecycleCostUsd: result.presentValue.present_value_total_lifecycle_cost_usd,
      lifecycleCostPerTargetWattUsd: result.costs.lifecycle_cost_per_target_watt_usd,
      powerSystemLcoeUsdPerMWh: result.lcoe.lcoe_usd_per_mwh,
      totalWorkloadDataTransferredGb: result.energy.total_workload_data_transferred_gb,
    });
  });

  it("keeps all cost summaries arithmetically reconciled", () => {
    const bucketSum = Object.values(result.costs.buckets_undiscounted).reduce((a, b) => a + b, 0);
    const lineItemSum = Object.values(result.costs.line_items_undiscounted).reduce((a, b) => a + b, 0);
    const scheduleSum = result.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
    expect(bucketSum).toBeCloseTo(result.costs.total_lifecycle_cost_usd, 3);
    expect(lineItemSum).toBeCloseTo(result.costs.total_lifecycle_cost_usd, 3);
    expect(scheduleSum).toBeCloseTo(result.costs.total_lifecycle_cost_usd, 3);
  });
});
