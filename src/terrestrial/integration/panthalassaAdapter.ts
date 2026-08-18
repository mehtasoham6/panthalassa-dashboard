import { DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS } from "../model/defaults.js";
import type {
  ComparableArchitectureOutputs,
  SharedComparisonInputs,
  TerrestrialArchitectureInputs,
  TerrestrialModelInputs,
} from "../model/types.js";

/** Structural subset of Panthalassa ModelInputs: no dependency on frozen source files. */
export interface PanthalassaSharedInputsLike {
  target_capacity_gw: number;
  analysis_period_years: number;
  compute_hardware_cost_usd_per_kw: number;
  workloadBandwidthIntensityMbpsPerKw: number;
}

export function sharedInputsFromPanthalassa(inputs: PanthalassaSharedInputsLike): SharedComparisonInputs {
  return {
    target_capacity_gw: inputs.target_capacity_gw,
    analysis_period_years: inputs.analysis_period_years,
    compute_hardware_cost_usd_per_kw: inputs.compute_hardware_cost_usd_per_kw,
    workloadBandwidthIntensityMbpsPerKw: inputs.workloadBandwidthIntensityMbpsPerKw,
  };
}

export function buildTerrestrialInputs(
  panthalassaInputs: PanthalassaSharedInputsLike,
  terrestrialInputs: TerrestrialArchitectureInputs = DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
): TerrestrialModelInputs {
  return {
    ...sharedInputsFromPanthalassa(panthalassaInputs),
    ...terrestrialInputs,
  };
}

/** Structural subset of the frozen Panthalassa ModelResult. */
export interface PanthalassaResultLike {
  inputs: PanthalassaSharedInputsLike & { payload_rating_kw: number };
  N_fleet: number;
  costs: {
    total_node_fleet_cost_usd: number;
    total_workload_data_transferred_gb: number;
  };
  presentValue: {
    yearly_delivered_energy_mwh: number[];
    present_value_total_node_fleet_cost_usd: number;
    present_value_workload_data_transfer_cost_usd: number;
    lifecycle_cost_per_target_watt_usd: number;
  };
  lcoe: { lcoe_usd_per_mwh: number };
}

export function comparableOutputsFromPanthalassa(result: PanthalassaResultLike): ComparableArchitectureOutputs {
  const initialComputeHardwareCapex =
    result.N_fleet *
    result.inputs.payload_rating_kw *
    result.inputs.compute_hardware_cost_usd_per_kw;

  return {
    architecture: "panthalassa",
    target_average_delivered_compute_gw: result.inputs.target_capacity_gw,
    installed_architecture_capacity_gw:
      (result.N_fleet * result.inputs.payload_rating_kw) / 1_000_000,
    analysis_period_years: result.inputs.analysis_period_years,
    analysis_period_delivered_compute_mwh: result.presentValue.yearly_delivered_energy_mwh.reduce(
      (total, annual) => total + annual,
      0,
    ),
    undiscounted_lifecycle_cost_usd: result.costs.total_node_fleet_cost_usd,
    present_value_lifecycle_cost_usd:
      result.presentValue.present_value_total_node_fleet_cost_usd,
    lifecycle_cost_per_target_watt_usd:
      result.presentValue.lifecycle_cost_per_target_watt_usd,
    power_system_lcoe_usd_per_mwh: result.lcoe.lcoe_usd_per_mwh,
    initial_compute_hardware_capex_usd: initialComputeHardwareCapex,
    total_workload_data_transferred_gb:
      result.costs.total_workload_data_transferred_gb,
    present_value_workload_data_transfer_cost_usd:
      result.presentValue.present_value_workload_data_transfer_cost_usd,
  };
}
