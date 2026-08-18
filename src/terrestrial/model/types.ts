/** Inputs deliberately shared with the frozen Panthalassa model. */
export interface SharedComparisonInputs {
  /** Average saleable IT compute that the architecture must deliver. */
  target_capacity_gw: number;
  analysis_period_years: number;
  compute_hardware_cost_usd_per_kw: number;
  workloadBandwidthIntensityMbpsPerKw: number;
}

/** Terrestrial-only assumptions. Percentages are decimal fractions. */
export interface TerrestrialArchitectureInputs {
  /**
   * Terrestrial-specific real discount rate: mature CCGT technology paired
   * with investment-grade, long-term-contracted data-center financing gets
   * materially better 2026 terms than a first-of-a-kind marine platform, so
   * this is deliberately decoupled from -- and lower than -- Panthalassa's
   * own real_discount_rate.
   */
  real_discount_rate: number;
  /**
   * Terrestrial-specific annual chip/GPU hardware failure hazard.
   * Deliberately decoupled from Panthalassa's own chip_failure_rate_annual:
   * this represents a normal terrestrial hyperscale GPU fleet, not a
   * marine-environment hazard, and terrestrial hardware is assumed to be
   * replaced immediately/locally rather than via Panthalassa's tug-based
   * service schedule (see compute_failure_treatment in the model result).
   */
  chip_failure_rate_annual: number;
  /** Total facility electricity / IT electricity. */
  pue: number;
  /** Expected fraction of nameplate generation available for the captive baseload duty. */
  power_system_availability: number;
  /** All-in overnight CCGT cost; scope is documented in docs/SOURCES_AND_ASSUMPTIONS.md. */
  ccgt_capex_usd_per_kw: number;
  /** Delivered plant-gate price; do not add transport again when using this input. */
  delivered_gas_price_usd_per_mmbtu: number;
  ccgt_fixed_om_usd_per_kw_year: number;
  ccgt_economic_life_years: number;
  /** Non-compute data-center facility cost per installed IT watt. */
  facility_capex_usd_per_it_watt: number;
}

export type TerrestrialModelInputs = SharedComparisonInputs & TerrestrialArchitectureInputs;

export interface TerrestrialCapacityResult {
  target_average_delivered_compute_mw: number;
  installed_compute_capacity_mw: number;
  average_facility_electrical_load_mw: number;
  ccgt_nameplate_capacity_mw: number;
  generation_nameplate_margin_over_average_load: number;
}

export interface TerrestrialEnergyResult {
  annual_delivered_compute_mwh: number;
  annual_generated_electricity_mwh: number;
  analysis_period_delivered_compute_mwh: number;
  analysis_period_generated_electricity_mwh: number;
  annual_natural_gas_mmbtu: number;
  analysis_period_natural_gas_mmbtu: number;
  analysis_period_natural_gas_bcf: number;
  total_workload_data_transferred_gb: number;
}

export interface TerrestrialCostResult {
  initial: {
    ccgt_capex_usd: number;
    facility_capex_usd: number;
    compute_hardware_capex_usd: number;
    total_initial_capex_usd: number;
  };
  annual_steady_state: {
    fuel_usd: number;
    ccgt_fixed_om_usd: number;
    ccgt_variable_om_usd: number;
    facility_maintenance_usd: number;
    compute_failure_replacement_usd: number;
    workload_data_transfer_usd: number;
    total_annual_recurring_usd: number;
  };
  line_items_undiscounted: {
    initial_and_planned_ccgt_capital_usd: number;
    initial_and_planned_facility_capital_usd: number;
    compute_hardware_capex_usd: number;
    fuel_usd: number;
    ccgt_fixed_om_usd: number;
    ccgt_variable_om_usd: number;
    facility_maintenance_usd: number;
    compute_failure_replacement_usd: number;
    workload_data_transfer_usd: number;
    ccgt_decommissioning_usd: number;
    facility_decommissioning_usd: number;
  };
  buckets_undiscounted: {
    power_system_usd: number;
    data_center_facility_usd: number;
    compute_and_replacement_usd: number;
    workload_data_transfer_usd: number;
  };
  total_lifecycle_cost_usd: number;
  lifecycle_cost_per_target_watt_usd: number;
}

export interface TerrestrialPresentValueResult {
  /** Index 0 is t=0; indexes 1..T are end-of-year buckets. */
  yearly_cost_usd: number[];
  yearly_delivered_compute_mwh: number[];
  yearly_generated_electricity_mwh: number[];
  present_value_total_lifecycle_cost_usd: number;
  present_value_workload_data_transfer_cost_usd: number;
}

export interface TerrestrialLcoeResult {
  lcoe_usd_per_mwh: number;
  lcoe_horizon_years: number;
  present_value_power_system_cost_usd: number;
  present_value_generated_electricity_mwh: number;
  /** Index 0 is t=0; indexes 1..life are end-of-year buckets. */
  yearly_power_system_cost_usd: number[];
  yearly_generated_electricity_mwh: number[];
}

/** Architecture-neutral fields intended for side-by-side dashboard tiles. */
export interface ComparableArchitectureOutputs {
  architecture: "terrestrial" | "panthalassa";
  target_average_delivered_compute_gw: number;
  installed_architecture_capacity_gw: number;
  analysis_period_years: number;
  analysis_period_delivered_compute_mwh: number;
  undiscounted_lifecycle_cost_usd: number;
  present_value_lifecycle_cost_usd: number;
  lifecycle_cost_per_target_watt_usd: number;
  power_system_lcoe_usd_per_mwh: number;
  initial_compute_hardware_capex_usd: number;
  total_workload_data_transferred_gb: number;
  present_value_workload_data_transfer_cost_usd: number;
}

export interface TerrestrialModelResult {
  inputs: TerrestrialModelInputs;
  capacity: TerrestrialCapacityResult;
  energy: TerrestrialEnergyResult;
  costs: TerrestrialCostResult;
  presentValue: TerrestrialPresentValueResult;
  lcoe: TerrestrialLcoeResult;
  comparable: ComparableArchitectureOutputs;
  methodology: {
    capacity_target_definition: string;
    lcoe_boundary: string;
    lifecycle_cost_boundary: string;
    residual_value_convention: string;
    compute_failure_treatment: string;
  };
}

export interface LegacyMcCalipInputs {
  years: number;
  targetGW: number;
  gasTurbineCapexPerKW: number;
  electricalCostPerW: number;
  mechanicalCostPerW: number;
  civilCostPerW: number;
  networkCostPerW: number;
  pue: number;
  gasPricePerMMBtu: number;
  heatRateBtuKwh: number;
  capacityFactor: number;
}

export interface LegacyMcCalipResult {
  powerGenCost: number;
  electricalCost: number;
  mechanicalCost: number;
  civilCost: number;
  networkCost: number;
  infraCapex: number;
  facilityCapexPerW: number;
  fuelCostPerMWh: number;
  fuelCostTotal: number;
  totalCost: number;
  energyMWh: number;
  generationMWh: number;
  costPerW: number;
  lcoe: number;
  gasConsumptionBCF: number;
  totalGenerationMW: number;
}
