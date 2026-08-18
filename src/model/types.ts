/** The 15 dashboard sliders (Appendix A.1). Percentages are decimal fractions here. */
export interface ModelInputs {
  target_capacity_gw: number;
  analysis_period_years: number;
  real_discount_rate: number;
  payload_rating_kw: number;
  battery_duration_hours: number;
  hull_diameter_m: number;
  sea_park_distance_km: number;
  node_lifetime_years: number;
  chip_failure_rate_annual: number;
  /** Share of installed payload held as best-effort/hot-spare capacity; determines the surprise-service trigger threshold. */
  hotSpareShare: number;
  node_failure_rate_annual: number;
  finished_hull_cost_usd_per_tonne: number;
  pto_cost_usd_per_kw: number;
  compute_hardware_cost_usd_per_kw: number;
  /** Average external workload data traffic per active kW of delivered compute (not intra-node networking). */
  workloadBandwidthIntensityMbpsPerKw: number;
  dataTransferCostPerGb: number;
}

export const DEFAULT_INPUTS: ModelInputs = {
  target_capacity_gw: 1,
  analysis_period_years: 5,
  real_discount_rate: 0.08,
  payload_rating_kw: 200,
  battery_duration_hours: 0.5,
  hull_diameter_m: 20,
  sea_park_distance_km: 1500,
  node_lifetime_years: 20,
  chip_failure_rate_annual: 0.01,
  hotSpareShare: 0.10,
  node_failure_rate_annual: 0.03,
  finished_hull_cost_usd_per_tonne: 2000,
  pto_cost_usd_per_kw: 200,
  compute_hardware_cost_usd_per_kw: 25000,
  workloadBandwidthIntensityMbpsPerKw: 0.03,
  dataTransferCostPerGb: 1.0,
};

/**
 * Compute-health engine result. Chip degradation is tracked continuously in
 * kW (no block granularity): healthy capacity decays as P*exp(-lambda*age)
 * from the moment of each restoration. A surprise service trip is triggered
 * purely by age (healthy capacity crossing the guaranteed/hot-spare
 * threshold), independent of fixed 5-year maintenance, whichever comes
 * first -- see chipFailures.ts.
 */
export interface ChipFailureResult {
  chip_adjusted_energy_kwh: number;
  expected_mode_1_surprise_service_event_count_per_position: number;
  scheduled_node_maintenance_event_count_per_position: number;
  /** Expected compute capacity (kW) actually replaced across all visits over the whole analysis period, per operating slot. */
  expected_failed_capacity_kw_replaced_per_position: number;
  /** Physical round trips attributable to compute-service activity (surprise + combined visits), deduplicated. */
  expected_mode_1_physical_tug_round_trips_per_position: number;
  /** Per-completed-year buckets (index 0 => year 1, ..., index T-1 => year T), absolute-time allocation. */
  yearly_delivered_energy_kwh: number[];
  yearly_failed_capacity_kw_replaced: number[];
  yearly_surprise_service_events: number[];
  yearly_scheduled_full_maintenance_events: number[];
  yearly_mode_1_tug_round_trips: number[];
}

export interface DerivedQuantities {
  capture_width_ratio: number;
  best_effort_capacity_kw: number;
  guaranteed_capacity_kw: number;
  self_propulsion_distance_km: number;
  one_way_tug_days: number;
  one_way_self_propulsion_days: number;
  one_way_journey_days: number;
  analysis_period_hours: number;
  pto_rating_kw: number;
  power_cap_kw: number;
  full_output_flux_kw_per_m: number;
  capture_coefficient: number;
  outbound_days: number;
  outbound_energy_kwh: number;
  /**
   * Historical (Copernicus WAVERYS, 1980-2025) sea-park wave-resource
   * capacity factor: mean wave-only compute power / installed payload, at
   * the current hull/efficiency/PTO/payload sliders. The only wave-resource
   * number ever displayed on the dashboard. See src/model/waverys.ts.
   */
  raw_wave_resource_cf: number;
  /**
   * Internal-only: raw_wave_resource_cf plus an episode-level battery
   * smoothing approximation (capped at 1.0), used to schedule sea-park
   * energy. Never displayed as a second dashboard capacity-factor metric.
   */
  effective_sea_park_cf: number;
}

/**
 * Power-system LCOE (Levelized Cost of Electricity): a standalone,
 * compute-agnostic metric for the node's non-compute power-generating
 * platform, evaluated over one full generating-asset economic life
 * (node_lifetime_years) for a single representative position. Independent
 * of the dashboard's analysis-period/target-fleet-capacity sliders and of
 * all chip-health/compute-service logic. See lcoe.ts.
 */
export interface LcoeResult {
  lcoe_usd_per_mwh: number;
  /** Always equal to node_lifetime_years -- LCOE's own horizon, not the dashboard's analysis period. */
  lcoe_horizon_years: number;
  present_value_power_system_cost_usd: number;
  present_value_electrical_energy_mwh: number;
  /** index 0 = year 0 (t=0, initial capital) .. index lcoe_horizon_years = end of economic life (retirement). */
  yearly_power_system_cost_usd: number[];
  yearly_electrical_energy_kwh: number[];
}

export interface ModelResult {
  inputs: ModelInputs;
  derived: DerivedQuantities;
  chip: ChipFailureResult;
  modeLosses: {
    mode_2_loss_kwh: number;
    mode_3_loss_kwh: number;
    mode_4_loss_kwh: number;
    mode_5_loss_kwh: number;
    total_modes_2_5_loss_kwh: number;
    mode_2_rate_annual: number;
    mode_3_rate_annual: number;
    mode_4_rate_annual: number;
    mode_5_rate_annual: number;
  };
  delivered_energy_kwh: number;
  expected_delivered_energy_per_position_mw_years: number;
  target_energy_mw_years: number;
  N_fleet: number;
  node_generations: number;
  planned_node_purchases: number;
  costs: {
    physical_node_cost_usd: number;
    non_compute_node_cost_usd: number;
    total_planned_physical_node_cost_usd: number;
    total_compute_replacement_cost_usd: number;
    total_non_compute_maintenance_failure_cost_usd: number;
    /** Undiscounted, whole-analysis-period workload data-transfer cost (recurring opex, not node capex). */
    total_workload_data_transfer_cost_usd: number;
    /** Fleet-wide workload data transferred over the whole analysis period, in GB. */
    total_workload_data_transferred_gb: number;
    total_node_fleet_cost_usd: number;
    buckets: {
      compute_and_replacement_usd: number;
      initial_non_compute_physical_usd: number;
      non_compute_maintenance_failure_usd: number;
      workload_data_transfer_usd: number;
    };
    lineItems: {
      compute_hardware_capex_usd: number;
      fleet_compute_replacement_cost_usd: number;
      fleet_complete_payload_replacement_cost_usd: number;
      normal_tug_cost_usd: number;
      scheduled_node_maintenance_cost_usd: number;
      unexpected_tug_cost_usd: number;
      mode_4_5_non_compute_replacement_cost_usd: number;
      unexpected_mechanical_repair_cost_usd: number;
      mode_5_catastrophic_cost_usd_total: number;
      node_retirement_cost_usd_total: number;
      workload_data_transfer_cost_usd: number;
    };
  };
  presentValue: {
    yearly_cost_usd: number[]; // index 0 = year 0 (t=0), ... index T = year T
    present_value_total_node_fleet_cost_usd: number;
    /** Discounted workload data-transfer cost (already included in present_value_total_node_fleet_cost_usd). */
    present_value_workload_data_transfer_cost_usd: number;
    lifecycle_cost_per_target_watt_usd: number;
    yearly_delivered_energy_mwh: number[]; // index 0 = year 0 .. T
  };
  /** Power-system LCOE ($/MWh) -- see LcoeResult. Not a levelized cost of delivered COMPUTE energy; do not use for compute-cost comparisons. */
  lcoe: LcoeResult;
}
