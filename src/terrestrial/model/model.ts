import { MODEL_CONSTANTS, TERRESTRIAL_POWER_SOURCE_SPECS } from "./defaults.js";
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
  // CCGT is sized by its dispatchable-plant availability margin; every other
  // power source is sized on an energy-balance basis (nameplate large enough
  // that, at its own capacity factor, average output matches average load).
  // Neither this nor anything downstream simulates whether that output
  // arrives when the data center actually needs it -- see docs/SOURCES_AND_ASSUMPTIONS.md.
  const utilizationFactor =
    inputs.power_source === "ccgt" ? inputs.power_system_availability : inputs.renewable_capacity_factor;
  const powerPlantNameplateCapacityMw = averageFacilityElectricalLoadMw / utilizationFactor;

  return {
    target_average_delivered_compute_mw: targetAverageDeliveredComputeMw,
    // On-site maintenance keeps this capacity productive; power-system
    // outages are covered by generation oversizing, not compute oversizing.
    installed_compute_capacity_mw: targetAverageDeliveredComputeMw,
    average_facility_electrical_load_mw: averageFacilityElectricalLoadMw,
    power_plant_nameplate_capacity_mw: powerPlantNameplateCapacityMw,
    generation_nameplate_margin_over_average_load:
      powerPlantNameplateCapacityMw / averageFacilityElectricalLoadMw - 1,
  };
}

function computeEnergy(inputs: TerrestrialModelInputs, capacity: TerrestrialCapacityResult): TerrestrialEnergyResult {
  const years = inputs.analysis_period_years;
  const annualDeliveredComputeMwh =
    capacity.target_average_delivered_compute_mw * MODEL_CONSTANTS.hours_per_year;
  const annualGeneratedElectricityMwh =
    capacity.average_facility_electrical_load_mw * MODEL_CONSTANTS.hours_per_year;
  const annualNaturalGasMmbtu =
    inputs.power_source === "ccgt"
      ? annualGeneratedElectricityMwh * (MODEL_CONSTANTS.ccgt_heat_rate_btu_per_kwh_hhv / 1_000)
      : 0;
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

/**
 * Six cost categories -- power plant, fuel, data center, chips, workload
 * (data), other opex -- each a genuine yearly schedule so its present value
 * is real, not approximated. Power plant / data center are pure planned
 * capital (CCGT / facility capex); chips is compute capex plus its own
 * failure-replacement cost; other opex is every recurring O&M/maintenance
 * line plus both decommissioning schedules. The six sum exactly to `total`.
 */
interface CostSchedules {
  total: number[];
  powerPlant: number[];
  fuel: number[];
  dataCenter: number[];
  chips: number[];
  otherOpex: number[];
  workload: number[];
}

function computeCostsAndSchedules(
  inputs: TerrestrialModelInputs,
  capacity: TerrestrialCapacityResult,
  energy: TerrestrialEnergyResult,
): { costs: TerrestrialCostResult; schedules: CostSchedules } {
  const years = inputs.analysis_period_years;
  const targetItKw = capacity.installed_compute_capacity_mw * 1_000;
  const targetItW = targetItKw * 1_000;
  const powerPlantNameplateKw = capacity.power_plant_nameplate_capacity_mw * 1_000;

  const isCcgt = inputs.power_source === "ccgt";
  const spec = TERRESTRIAL_POWER_SOURCE_SPECS[inputs.power_source];

  // Generation-only capex/fixed O&M: CCGT uses its own fields; every other
  // power source shares the renewable_* fields (see types.ts doc comments).
  const generationCapex = isCcgt
    ? powerPlantNameplateKw * inputs.ccgt_capex_usd_per_kw
    : powerPlantNameplateKw * inputs.renewable_capex_usd_per_kw;
  const annualGenerationFixedOm = isCcgt
    ? powerPlantNameplateKw * inputs.ccgt_fixed_om_usd_per_kw_year
    : powerPlantNameplateKw * inputs.renewable_fixed_om_usd_per_kw_year;

  // Battery, for the three storage-paired sources only: sized at Lazard's
  // fixed 50%-of-capacity/4-hour ratio (renewable_storage_kwh_per_kw).
  // Treated as part of the power plant's own capital, alongside generation.
  const storageKwh = spec.hasStorage ? powerPlantNameplateKw * MODEL_CONSTANTS.renewable_storage_kwh_per_kw : 0;
  const storageCapex = storageKwh * inputs.renewable_storage_capex_usd_per_kwh;
  const annualStorageOm = storageKwh * MODEL_CONSTANTS.renewable_storage_om_usd_per_kwh;
  const powerPlantCapex = generationCapex + storageCapex;

  const facilityCapex = targetItW * inputs.facility_capex_usd_per_it_watt;
  const computeCapex = targetItKw * inputs.compute_hardware_cost_usd_per_kw;

  // Fuel: CCGT only, zero for every other power source.
  const annualFuel = isCcgt ? energy.annual_natural_gas_mmbtu * inputs.delivered_gas_price_usd_per_mmbtu : 0;
  // "Variable O&M" slot: CCGT's own $/MWh constant for CCGT; geothermal's
  // own slider-driven $/MWh for geothermal (its output-linked O&M, Lazard's
  // closest analog to fuel); storage O&M for the three battery-paired
  // sources (there's no variable-output cost for solar/wind themselves).
  const annualOutputLinkedOm = isCcgt
    ? energy.annual_generated_electricity_mwh * MODEL_CONSTANTS.ccgt_variable_om_usd_per_mwh
    : spec.hasVariableOm
      ? energy.annual_generated_electricity_mwh * inputs.geothermal_variable_om_usd_per_mwh
      : 0;
  const annualVariableOmSlot = isCcgt ? annualOutputLinkedOm : annualStorageOm + annualOutputLinkedOm;

  const annualFacilityMaintenance = targetItKw * MODEL_CONSTANTS.facility_maintenance_usd_per_it_kw_year;
  // With immediate local replacement and a memoryless annual failure hazard,
  // expected failed capacity replaced per year is installed kW * lambda.
  const annualComputeFailureReplacement =
    targetItKw * inputs.chip_failure_rate_annual * inputs.compute_hardware_cost_usd_per_kw;
  const annualWorkloadDataGb = energy.total_workload_data_transferred_gb / years;
  const annualWorkloadCost = annualWorkloadDataGb * MODEL_CONSTANTS.terrestrial_data_transfer_cost_usd_per_gb;
  const annualRecurring =
    annualFuel +
    annualGenerationFixedOm +
    annualVariableOmSlot +
    annualFacilityMaintenance +
    annualComputeFailureReplacement +
    annualWorkloadCost;

  // Power-plant economic life: CCGT's own slider, or the selected
  // technology's fixed Lazard facility life (always well above the 15-year
  // analysis-period ceiling, so -- like CCGT -- capital is always charged
  // once, in full, at t=0; see TERRESTRIAL_POWER_SOURCE_SPECS).
  const powerPlantEconomicLifeYears = isCcgt ? inputs.ccgt_economic_life_years : spec.facilityLifeYears;

  const totalSchedule = new Array<number>(years + 1).fill(0);
  const workloadSchedule = new Array<number>(years + 1).fill(0);
  const chipsSchedule = new Array<number>(years + 1).fill(0);
  const otherOpexSchedule = new Array<number>(years + 1).fill(0);
  const fuelSchedule = new Array<number>(years + 1).fill(0);
  const powerPlantCapitalSchedule = plannedCapitalSchedule(powerPlantCapex, powerPlantEconomicLifeYears, years);
  const facilityCapitalSchedule = plannedCapitalSchedule(
    facilityCapex,
    MODEL_CONSTANTS.facility_economic_life_years,
    years,
  );
  // Reuses the same generic decommissioning-fraction convention CCGT already
  // used -- no per-technology renewable decommissioning data exists to
  // source anything more specific (see MODEL_CONSTANTS doc comment).
  const powerPlantRetirementSchedule = retirementSchedule(
    powerPlantCapex,
    powerPlantEconomicLifeYears,
    years,
    MODEL_CONSTANTS.ccgt_decommissioning_fraction,
  );
  const facilityRetirementSchedule = retirementSchedule(
    facilityCapex,
    MODEL_CONSTANTS.facility_economic_life_years,
    years,
    MODEL_CONSTANTS.facility_decommissioning_fraction,
  );

  // Other opex = every recurring O&M/maintenance line plus both
  // decommissioning schedules (decommissioning is operational-lifecycle
  // cost, not part of the initial-asset capital categories).
  addSchedules(otherOpexSchedule, powerPlantRetirementSchedule);
  addSchedules(otherOpexSchedule, facilityRetirementSchedule);
  chipsSchedule[0]! += computeCapex;
  for (let year = 1; year <= years; year++) {
    otherOpexSchedule[year]! += annualGenerationFixedOm + annualVariableOmSlot + annualFacilityMaintenance;
    chipsSchedule[year]! += annualComputeFailureReplacement;
    fuelSchedule[year]! += annualFuel;
    workloadSchedule[year] = annualWorkloadCost;
  }

  addSchedules(totalSchedule, powerPlantCapitalSchedule);
  addSchedules(totalSchedule, facilityCapitalSchedule);
  addSchedules(totalSchedule, chipsSchedule);
  addSchedules(totalSchedule, otherOpexSchedule);
  addSchedules(totalSchedule, workloadSchedule);
  addSchedules(totalSchedule, fuelSchedule);

  const powerPlantCapitalTotal = sum(powerPlantCapitalSchedule);
  const facilityCapitalTotal = sum(facilityCapitalSchedule);
  const powerPlantRetirementTotal = sum(powerPlantRetirementSchedule);
  const facilityRetirementTotal = sum(facilityRetirementSchedule);
  const fuelTotal = annualFuel * years;
  const generationFixedOmTotal = annualGenerationFixedOm * years;
  const variableOmSlotTotal = annualVariableOmSlot * years;
  const facilityMaintenanceTotal = annualFacilityMaintenance * years;
  const computeFailureReplacementTotal = annualComputeFailureReplacement * years;
  const workloadTotal = annualWorkloadCost * years;
  const totalLifecycleCost = sum(totalSchedule);

  const costs: TerrestrialCostResult = {
    initial: {
      power_plant_capex_usd: powerPlantCapex,
      facility_capex_usd: facilityCapex,
      compute_hardware_capex_usd: computeCapex,
      total_initial_capex_usd: powerPlantCapex + facilityCapex + computeCapex,
    },
    annual_steady_state: {
      fuel_usd: annualFuel,
      ccgt_fixed_om_usd: annualGenerationFixedOm,
      ccgt_variable_om_usd: annualVariableOmSlot,
      facility_maintenance_usd: annualFacilityMaintenance,
      compute_failure_replacement_usd: annualComputeFailureReplacement,
      workload_data_transfer_usd: annualWorkloadCost,
      total_annual_recurring_usd: annualRecurring,
    },
    line_items_undiscounted: {
      initial_and_planned_ccgt_capital_usd: powerPlantCapitalTotal,
      initial_and_planned_facility_capital_usd: facilityCapitalTotal,
      compute_hardware_capex_usd: computeCapex,
      fuel_usd: fuelTotal,
      ccgt_fixed_om_usd: generationFixedOmTotal,
      ccgt_variable_om_usd: variableOmSlotTotal,
      facility_maintenance_usd: facilityMaintenanceTotal,
      compute_failure_replacement_usd: computeFailureReplacementTotal,
      workload_data_transfer_usd: workloadTotal,
      ccgt_decommissioning_usd: powerPlantRetirementTotal,
      facility_decommissioning_usd: facilityRetirementTotal,
    },
    buckets_undiscounted: {
      power_system_usd:
        powerPlantCapitalTotal + fuelTotal + generationFixedOmTotal + variableOmSlotTotal + powerPlantRetirementTotal,
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
      powerPlant: powerPlantCapitalSchedule,
      fuel: fuelSchedule,
      dataCenter: facilityCapitalSchedule,
      chips: chipsSchedule,
      otherOpex: otherOpexSchedule,
      workload: workloadSchedule,
    },
  };
}

/** Sums discount(schedule[year], r, year) over the whole horizon -- a genuine present value, not an approximation. */
function presentValueOfSchedule(schedule: number[], r: number): number {
  let total = 0;
  for (let year = 0; year < schedule.length; year++) {
    total += discount(schedule[year]!, r, year);
  }
  return total;
}

function computePresentValue(
  inputs: TerrestrialModelInputs,
  energy: TerrestrialEnergyResult,
  schedules: CostSchedules,
): TerrestrialPresentValueResult {
  const years = inputs.analysis_period_years;
  const yearlyCompute = new Array<number>(years + 1).fill(0);
  const yearlyElectricity = new Array<number>(years + 1).fill(0);

  for (let year = 0; year <= years; year++) {
    if (year > 0) {
      yearlyCompute[year] = energy.annual_delivered_compute_mwh;
      yearlyElectricity[year] = energy.annual_generated_electricity_mwh;
    }
  }

  const r = inputs.real_discount_rate;
  const presentValuePowerPlant = presentValueOfSchedule(schedules.powerPlant, r);
  const presentValueFuel = presentValueOfSchedule(schedules.fuel, r);
  const presentValueDataCenter = presentValueOfSchedule(schedules.dataCenter, r);
  const presentValueChips = presentValueOfSchedule(schedules.chips, r);
  const presentValueOtherOpex = presentValueOfSchedule(schedules.otherOpex, r);
  const presentValueWorkload = presentValueOfSchedule(schedules.workload, r);
  // Sum of the six categories, not a fresh discount pass over schedules.total --
  // identical by linearity, and keeps "parts sum to the total" true by
  // construction rather than by coincidence.
  const presentValueTotal =
    presentValuePowerPlant + presentValueFuel + presentValueDataCenter + presentValueChips + presentValueOtherOpex + presentValueWorkload;

  return {
    yearly_cost_usd: schedules.total,
    yearly_delivered_compute_mwh: yearlyCompute,
    yearly_generated_electricity_mwh: yearlyElectricity,
    present_value_total_lifecycle_cost_usd: presentValueTotal,
    present_value_power_plant_cost_usd: presentValuePowerPlant,
    present_value_fuel_cost_usd: presentValueFuel,
    present_value_data_center_cost_usd: presentValueDataCenter,
    present_value_chips_cost_usd: presentValueChips,
    present_value_other_opex_cost_usd: presentValueOtherOpex,
    present_value_workload_data_transfer_cost_usd: presentValueWorkload,
  };
}

export function runTerrestrialModel(inputs: TerrestrialModelInputs): TerrestrialModelResult {
  validateTerrestrialInputs(inputs);
  const frozenInputs = { ...inputs };
  const capacity = computeCapacity(frozenInputs);
  const energy = computeEnergy(frozenInputs, capacity);
  const { costs: undiscountedCosts, schedules } = computeCostsAndSchedules(frozenInputs, capacity, energy);
  const presentValue = computePresentValue(frozenInputs, energy, schedules);
  const lcoe = computeTerrestrialPowerSystemLcoe(frozenInputs);

  // lifecycle_cost_per_target_watt_usd is present-value-based (see
  // ArchitectureComparison's "All-in cost per target watt" row), so it can
  // only be finalized once presentValue exists -- override the undiscounted
  // placeholder computeCostsAndSchedules had to compute internally.
  const lifecycle_cost_per_target_watt_usd =
    presentValue.present_value_total_lifecycle_cost_usd / (frozenInputs.target_capacity_gw * 1_000_000_000);
  const costs: TerrestrialCostResult = { ...undiscountedCosts, lifecycle_cost_per_target_watt_usd };

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
      installed_architecture_capacity_gw: capacity.power_plant_nameplate_capacity_mw / 1_000,
      analysis_period_years: frozenInputs.analysis_period_years,
      analysis_period_delivered_compute_mwh: energy.analysis_period_delivered_compute_mwh,
      undiscounted_lifecycle_cost_usd: costs.total_lifecycle_cost_usd,
      present_value_lifecycle_cost_usd: presentValue.present_value_total_lifecycle_cost_usd,
      lifecycle_cost_per_target_watt_usd,
      power_system_lcoe_usd_per_mwh: lcoe.lcoe_usd_per_mwh,
      initial_compute_hardware_capex_usd: costs.initial.compute_hardware_capex_usd,
      total_workload_data_transferred_gb: energy.total_workload_data_transferred_gb,
      present_value_workload_data_transfer_cost_usd:
        presentValue.present_value_workload_data_transfer_cost_usd,
    },
    methodology: {
      capacity_target_definition: `Average delivered IT compute. ${TERRESTRIAL_POWER_SOURCE_SPECS[frozenInputs.power_source].label} nameplate is oversized by PUE and ${isCcgt(frozenInputs) ? "power-system availability" : "capacity factor (an energy-balance sizing -- see docs/SOURCES_AND_ASSUMPTIONS.md; this does not model whether output arrives when needed)"}.`,
      lcoe_boundary: `${TERRESTRIAL_POWER_SOURCE_SPECS[frozenInputs.power_source].label} power system only: overnight capex${isCcgt(frozenInputs) ? ", fuel," : TERRESTRIAL_POWER_SOURCE_SPECS[frozenInputs.power_source].hasStorage ? " (incl. battery)," : ""} fixed O&M, variable O&M, and decommissioning divided by net generated electricity over the power plant's economic life.`,
      lifecycle_cost_boundary: "Taxes, insurance, financing, and corporate overhead are excluded for symmetry with Panthalassa.",
      residual_value_convention:
        "Initial assets are charged in full; there is no terminal residual-value credit. Later planned generations are attributed only for the fraction of their life used inside the analysis horizon.",
      compute_failure_treatment:
        "Failed compute is replaced locally and continuously at expected rate lambda, preserving delivered compute; replacement hardware cost is included.",
    },
  };
}

function isCcgt(inputs: TerrestrialModelInputs): boolean {
  return inputs.power_source === "ccgt";
}
