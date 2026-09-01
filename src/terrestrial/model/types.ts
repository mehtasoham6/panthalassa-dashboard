/** Inputs deliberately shared with the frozen Panthalassa model. */
export interface SharedComparisonInputs {
  target_capacity_gw: number;
  analysis_period_years: number;
  compute_hardware_cost_usd_per_kw: number;
  workloadBandwidthIntensityMbpsPerKw: number;
}

/**
 * Which physical power source supplies the data center. CCGT is the
 * original/default architecture; the other four are priced from Lazard's
 * LCOE+ (July 2026) per-technology assumption tables. Solar and both Wind
 * options ship "with battery" (Lazard's Solar/Wind + Storage configuration,
 * generation capacity's own 50%/4-hour ratio) since nobody would seriously
 * propose powering a captive data center from solar or wind alone; Geothermal
 * skips storage because its 80-90% capacity factor is already close to
 * baseload.
 */
export type TerrestrialPowerSource = "ccgt" | "solar" | "wind_onshore" | "wind_offshore" | "geothermal";

/**
 * Terrestrial-only assumptions. Percentages are decimal fractions.
 *
 * Only the fields relevant to the selected `power_source` are exposed as
 * sliders (see integration/sliderConfig.ts) and used by the model -- the
 * rest sit here holding that technology's own last-set values so switching
 * `power_source` and back doesn't lose anything, but they otherwise have no
 * effect. CCGT fields (`power_system_availability` through
 * `ccgt_economic_life_years`) are used only when power_source === "ccgt".
 * `renewable_*` fields are used for solar/wind_onshore/wind_offshore/geothermal.
 * `renewable_storage_capex_usd_per_kwh` is used only for the three
 * battery-paired sources (solar/wind_onshore/wind_offshore).
 * `geothermal_variable_om_usd_per_mwh` is used only for geothermal.
 */
export interface TerrestrialArchitectureInputs {
  real_discount_rate: number;
  chip_failure_rate_annual: number;
  pue: number;
  power_source: TerrestrialPowerSource;
  power_system_availability: number;
  ccgt_capex_usd_per_kw: number;
  delivered_gas_price_usd_per_mmbtu: number;
  ccgt_fixed_om_usd_per_kw_year: number;
  ccgt_economic_life_years: number;
  renewable_capex_usd_per_kw: number;
  renewable_fixed_om_usd_per_kw_year: number;
  renewable_capacity_factor: number;
  renewable_storage_capex_usd_per_kwh: number;
  geothermal_variable_om_usd_per_mwh: number;
  facility_capex_usd_per_it_watt: number;
}

export type TerrestrialModelInputs = SharedComparisonInputs & TerrestrialArchitectureInputs;

export interface TerrestrialCapacityResult {
  target_average_delivered_compute_mw: number;
  installed_compute_capacity_mw: number;
  average_facility_electrical_load_mw: number;
  /** Generation-only nameplate (excludes battery power rating) for whichever power_source is selected. */
  power_plant_nameplate_capacity_mw: number;
  generation_nameplate_margin_over_average_load: number;
}

export interface TerrestrialEnergyResult {
  annual_delivered_compute_mwh: number;
  annual_generated_electricity_mwh: number;
  analysis_period_delivered_compute_mwh: number;
  analysis_period_generated_electricity_mwh: number;
  /** Zero for every non-CCGT power source. */
  annual_natural_gas_mmbtu: number;
  analysis_period_natural_gas_mmbtu: number;
  analysis_period_natural_gas_bcf: number;
  total_workload_data_transferred_gb: number;
}

export interface TerrestrialCostResult {
  initial: {
    /** Generation + (if applicable) storage capex for the selected power source. */
    power_plant_capex_usd: number;
    facility_capex_usd: number;
    compute_hardware_capex_usd: number;
    total_initial_capex_usd: number;
  };
  annual_steady_state: {
    /** Zero for every non-CCGT power source. */
    fuel_usd: number;
    /** The selected power source's own generation fixed O&M. */
    ccgt_fixed_om_usd: number;
    /** For CCGT: variable O&M. For a battery-paired renewable: storage O&M. For geothermal: variable O&M. Zero otherwise. */
    ccgt_variable_om_usd: number;
    facility_maintenance_usd: number;
    compute_failure_replacement_usd: number;
    workload_data_transfer_usd: number;
    total_annual_recurring_usd: number;
  };
  line_items_undiscounted: {
    /** Generation + storage planned capital schedule total, for whichever power_source is selected. */
    initial_and_planned_ccgt_capital_usd: number;
    initial_and_planned_facility_capital_usd: number;
    compute_hardware_capex_usd: number;
    fuel_usd: number;
    ccgt_fixed_om_usd: number;
    ccgt_variable_om_usd: number;
    facility_maintenance_usd: number;
    compute_failure_replacement_usd: number;
    workload_data_transfer_usd: number;
    /** Power-plant decommissioning (generation + storage), any power_source. */
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
  /**
   * Six cost categories, each a genuine discounted present value, summing
   * exactly to present_value_total_lifecycle_cost_usd: power plant and data
   * center are pure planned capital (generation + storage capex, or CCGT
   * capex / facility capex only); chips is compute capex plus its own
   * failure-replacement cost; other opex is every recurring O&M/maintenance
   * line (including storage O&M) plus both decommissioning schedules.
   */
  present_value_power_plant_cost_usd: number;
  present_value_fuel_cost_usd: number;
  present_value_data_center_cost_usd: number;
  present_value_chips_cost_usd: number;
  present_value_other_opex_cost_usd: number;
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
