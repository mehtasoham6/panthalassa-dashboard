import { MODEL_CONSTANTS } from "./defaults.js";
import { addSchedules, discount, plannedCapitalSchedule, retirementSchedule, sum } from "./economics.js";
import { computeTerrestrialPowerSystemLcoe } from "./lcoe.js";
import type {
  TerrestrialCapacityResult,
  TerrestrialCostResult,
  TerrestrialEnergyResult,
  TerrestrialModelInputs,
  TerrestrialModelResult,
  TerrestrialPresentValueResult,
} from "./types.js";
import { validateTerrestrialInputs } from "./validation.js";

function computeCapacity(inputs: TerrestrialModelInputs): TerrestrialCapacityResult {
  const targetAverageDeliveredComputeMw = inputs.target_capacity_gw * 1_000;
  const averageFacilityElectricalLoadMw = targetAverageDeliveredComputeMw * inputs.pue;
  const ccgtNameplateCapacityMw = averageFacilityElectricalLoadMw / inputs.power_system_availability;

  return {
    target_average_delivered_compute_mw: targetAverageDeliveredComputeMw,
    // On-site maintenance keeps this capacity productive; power-system
    // outages are covered by generation oversizing, not compute oversizing.
    installed_compute_capacity_mw: targetAverageDeliveredComputeMw,
    average_facility_electrical_load_mw: averageFacilityElectricalLoadMw,
    ccgt_nameplate_capacity_mw: ccgtNameplateCapacityMw,
    generation_nameplate_margin_over_average_load:
      ccgtNameplateCapacityMw / averageFacilityElectricalLoadMw - 1,
  };
}

function computeEnergy(inputs: TerrestrialModelInputs, capacity: TerrestrialCapacityResult): TerrestrialEnergyResult {
  const years = inputs.analysis_period_years;
  const annualDeliveredComputeMwh =
    capacity.target_average_delivered_compute_mw * MODEL_CONSTANTS.hours_per_year;
  const annualGeneratedElectricityMwh =
    capacity.average_facility_electrical_load_mw * MODEL_CONSTANTS.hours_per_year;
  const annualNaturalGasMmbtu =
    annualGeneratedElectricityMwh * (MODEL_CONSTANTS.ccgt_heat_rate_btu_per_kwh_hhv / 1_000);
  const analysisNaturalGasMmbtu = annualNaturalGasMmbtu * years;
  const analysisNaturalGasBcf =
    (analysisNaturalGasMmbtu * 1_000_000) /
    MODEL_CONSTANTS.natural_gas_btu_per_standard_cubic_foot /
    1_000_000_000;
  const analysisDeliveredComputeMwh = annualDeliveredComputeMwh * years;
  const totalWorkloadDataTransferredGb =
    MODEL_CONSTANTS.workload_data_transfer_gb_per_mbps_kwh *
    inputs.workloadBandwidthIntensityMbpsPerKw *
    analysisDeliveredComputeMwh *
    1_000;

  return {
    annual_delivered_compute_mwh: annualDeliveredComputeMwh,
    annual_generated_electricity_mwh: annualGeneratedElectricityMwh,
    analysis_period_delivered_compute_mwh: analysisDeliveredComputeMwh,
    analysis_period_generated_electricity_mwh: annualGeneratedElectricityMwh * years,
    annual_natural_gas_mmbtu: annualNaturalGasMmbtu,
    analysis_period_natural_gas_mmbtu: analysisNaturalGasMmbtu,
    analysis_period_natural_gas_bcf: analysisNaturalGasBcf,
    total_workload_data_transferred_gb: totalWorkloadDataTransferredGb,
  };
}

interface CostSchedules {
  total: number[];
  workload: number[];
  ccgtCapital: number[];
  facilityCapital: number[];
  ccgtRetirement: number[];
  facilityRetirement: number[];
}

function computeCostsAndSchedules(
  inputs: TerrestrialModelInputs,
  capacity: TerrestrialCapacityResult,
  energy: TerrestrialEnergyResult,
): { costs: TerrestrialCostResult; schedules: CostSchedules } {
  const years = inputs.analysis_period_years;
  const targetItKw = capacity.installed_compute_capacity_mw * 1_000;
  const targetItW = targetItKw * 1_000;
  const ccgtNameplateKw = capacity.ccgt_nameplate_capacity_mw * 1_000;

  const ccgtCapex = ccgtNameplateKw * inputs.ccgt_capex_usd_per_kw;
  const facilityCapex = targetItW * inputs.facility_capex_usd_per_it_watt;
  const computeCapex = targetItKw * inputs.compute_hardware_cost_usd_per_kw;

  const annualFuel = energy.annual_natural_gas_mmbtu * inputs.delivered_gas_price_usd_per_mmbtu;
  const annualCcgtFixedOm = ccgtNameplateKw * inputs.ccgt_fixed_om_usd_per_kw_year;
  const annualCcgtVariableOm = energy.annual_generated_electricity_mwh * MODEL_CONSTANTS.ccgt_variable_om_usd_per_mwh;
  const annualFacilityMaintenance = targetItKw * MODEL_CONSTANTS.facility_maintenance_usd_per_it_kw_year;
  // With immediate local replacement and a memoryless annual failure hazard,
  // expected failed capacity replaced per year is installed kW * lambda.
  const annualComputeFailureReplacement =
    targetItKw * inputs.chip_failure_rate_annual * inputs.compute_hardware_cost_usd_per_kw;
  const annualWorkloadDataGb = energy.total_workload_data_transferred_gb / years;
  const annualWorkloadCost = annualWorkloadDataGb * MODEL_CONSTANTS.terrestrial_data_transfer_cost_usd_per_gb;
  const annualRecurring =
    annualFuel +
    annualCcgtFixedOm +
    annualCcgtVariableOm +
    annualFacilityMaintenance +
    annualComputeFailureReplacement +
    annualWorkloadCost;

  const totalSchedule = new Array<number>(years + 1).fill(0);
  const workloadSchedule = new Array<number>(years + 1).fill(0);
  const ccgtCapitalSchedule = plannedCapitalSchedule(ccgtCapex, inputs.ccgt_economic_life_years, years);
  const facilityCapitalSchedule = plannedCapitalSchedule(
    facilityCapex,
    MODEL_CONSTANTS.facility_economic_life_years,
    years,
  );
  const ccgtRetirementSchedule = retirementSchedule(
    ccgtCapex,
    inputs.ccgt_economic_life_years,
    years,
    MODEL_CONSTANTS.ccgt_decommissioning_fraction,
  );
  const facilityRetirementSchedule = retirementSchedule(
    facilityCapex,
    MODEL_CONSTANTS.facility_economic_life_years,
    years,
    MODEL_CONSTANTS.facility_decommissioning_fraction,
  );

  addSchedules(totalSchedule, ccgtCapitalSchedule);
  addSchedules(totalSchedule, facilityCapitalSchedule);
  addSchedules(totalSchedule, ccgtRetirementSchedule);
  addSchedules(totalSchedule, facilityRetirementSchedule);
  totalSchedule[0]! += computeCapex;
  for (let year = 1; year <= years; year++) {
    totalSchedule[year]! += annualRecurring;
    workloadSchedule[year] = annualWorkloadCost;
  }

  const ccgtCapitalTotal = sum(ccgtCapitalSchedule);
  const facilityCapitalTotal = sum(facilityCapitalSchedule);
  const ccgtRetirementTotal = sum(ccgtRetirementSchedule);
  const facilityRetirementTotal = sum(facilityRetirementSchedule);
  const fuelTotal = annualFuel * years;
  const ccgtFixedOmTotal = annualCcgtFixedOm * years;
  const ccgtVariableOmTotal = annualCcgtVariableOm * years;
  const facilityMaintenanceTotal = annualFacilityMaintenance * years;
  const computeFailureReplacementTotal = annualComputeFailureReplacement * years;
  const workloadTotal = annualWorkloadCost * years;
  const totalLifecycleCost = sum(totalSchedule);

  const costs: TerrestrialCostResult = {
    initial: {
      ccgt_capex_usd: ccgtCapex,
      facility_capex_usd: facilityCapex,
      compute_hardware_capex_usd: computeCapex,
      total_initial_capex_usd: ccgtCapex + facilityCapex + computeCapex,
    },
    annual_steady_state: {
      fuel_usd: annualFuel,
      ccgt_fixed_om_usd: annualCcgtFixedOm,
      ccgt_variable_om_usd: annualCcgtVariableOm,
      facility_maintenance_usd: annualFacilityMaintenance,
      compute_failure_replacement_usd: annualComputeFailureReplacement,
      workload_data_transfer_usd: annualWorkloadCost,
      total_annual_recurring_usd: annualRecurring,
    },
    line_items_undiscounted: {
      initial_and_planned_ccgt_capital_usd: ccgtCapitalTotal,
      initial_and_planned_facility_capital_usd: facilityCapitalTotal,
      compute_hardware_capex_usd: computeCapex,
      fuel_usd: fuelTotal,
      ccgt_fixed_om_usd: ccgtFixedOmTotal,
      ccgt_variable_om_usd: ccgtVariableOmTotal,
      facility_maintenance_usd: facilityMaintenanceTotal,
      compute_failure_replacement_usd: computeFailureReplacementTotal,
      workload_data_transfer_usd: workloadTotal,
      ccgt_decommissioning_usd: ccgtRetirementTotal,
      facility_decommissioning_usd: facilityRetirementTotal,
    },
    buckets_undiscounted: {
      power_system_usd:
        ccgtCapitalTotal + fuelTotal + ccgtFixedOmTotal + ccgtVariableOmTotal + ccgtRetirementTotal,
      data_center_facility_usd: facilityCapitalTotal + facilityMaintenanceTotal + facilityRetirementTotal,
      compute_and_replacement_usd: computeCapex + computeFailureReplacementTotal,
      workload_data_transfer_usd: workloadTotal,
    },
    total_lifecycle_cost_usd: totalLifecycleCost,
    lifecycle_cost_per_target_watt_usd:
      totalLifecycleCost / (inputs.target_capacity_gw * 1_000_000_000),
  };

  return {
    costs,
    schedules: {
      total: totalSchedule,
      workload: workloadSchedule,
      ccgtCapital: ccgtCapitalSchedule,
      facilityCapital: facilityCapitalSchedule,
      ccgtRetirement: ccgtRetirementSchedule,
      facilityRetirement: facilityRetirementSchedule,
    },
  };
}

function computePresentValue(
  inputs: TerrestrialModelInputs,
  energy: TerrestrialEnergyResult,
  schedules: CostSchedules,
): TerrestrialPresentValueResult {
  const years = inputs.analysis_period_years;
  const yearlyCompute = new Array<number>(years + 1).fill(0);
  const yearlyElectricity = new Array<number>(years + 1).fill(0);
  let presentValueTotal = 0;
  let presentValueWorkload = 0;

  for (let year = 0; year <= years; year++) {
    if (year > 0) {
      yearlyCompute[year] = energy.annual_delivered_compute_mwh;
      yearlyElectricity[year] = energy.annual_generated_electricity_mwh;
    }
    presentValueTotal += discount(schedules.total[year]!, inputs.real_discount_rate, year);
    presentValueWorkload += discount(schedules.workload[year]!, inputs.real_discount_rate, year);
  }

  return {
    yearly_cost_usd: schedules.total,
    yearly_delivered_compute_mwh: yearlyCompute,
    yearly_generated_electricity_mwh: yearlyElectricity,
    present_value_total_lifecycle_cost_usd: presentValueTotal,
    present_value_workload_data_transfer_cost_usd: presentValueWorkload,
  };
}

export function runTerrestrialModel(inputs: TerrestrialModelInputs): TerrestrialModelResult {
  validateTerrestrialInputs(inputs);
  const frozenInputs = { ...inputs };
  const capacity = computeCapacity(frozenInputs);
  const energy = computeEnergy(frozenInputs, capacity);
  const { costs, schedules } = computeCostsAndSchedules(frozenInputs, capacity, energy);
  const presentValue = computePresentValue(frozenInputs, energy, schedules);
  const lcoe = computeTerrestrialPowerSystemLcoe(frozenInputs);

  return {
    inputs: frozenInputs,
    capacity,
    energy,
    costs,
    presentValue,
    lcoe,
    comparable: {
      architecture: "terrestrial",
      target_average_delivered_compute_gw: frozenInputs.target_capacity_gw,
      installed_architecture_capacity_gw: capacity.ccgt_nameplate_capacity_mw / 1_000,
      analysis_period_years: frozenInputs.analysis_period_years,
      analysis_period_delivered_compute_mwh: energy.analysis_period_delivered_compute_mwh,
      undiscounted_lifecycle_cost_usd: costs.total_lifecycle_cost_usd,
      present_value_lifecycle_cost_usd: presentValue.present_value_total_lifecycle_cost_usd,
      lifecycle_cost_per_target_watt_usd: costs.lifecycle_cost_per_target_watt_usd,
      power_system_lcoe_usd_per_mwh: lcoe.lcoe_usd_per_mwh,
      initial_compute_hardware_capex_usd: costs.initial.compute_hardware_capex_usd,
      total_workload_data_transferred_gb: energy.total_workload_data_transferred_gb,
      present_value_workload_data_transfer_cost_usd:
        presentValue.present_value_workload_data_transfer_cost_usd,
    },
    methodology: {
      capacity_target_definition:
        "Average delivered IT compute. CCGT nameplate is oversized by PUE and power-system availability.",
      lcoe_boundary:
        "CCGT power system only: overnight capex, fuel, fixed O&M, variable O&M, and decommissioning divided by net generated electricity over the CCGT economic life.",
      lifecycle_cost_boundary:
        "Direct physical-system lifecycle cost: CCGT, facility, compute, physical maintenance, failure replacement, workload transfer, and retirement. Taxes, insurance, financing, and corporate overhead are excluded for symmetry with Panthalassa.",
      residual_value_convention:
        "Initial assets are charged in full; there is no terminal residual-value credit. Later planned generations are attributed only for the fraction of their life used inside the analysis horizon.",
      compute_failure_treatment:
        "Failed compute is replaced locally and continuously at expected rate lambda, preserving delivered compute; replacement hardware cost is included.",
    },
  };
}
