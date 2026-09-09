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
  sea_park_distance_km: 800,
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
   * capacity factor (energy average, with an episode-level battery
   * smoothing approximation folded in, capped at 1.0). This is the value
   * that actually schedules sea-park energy delivery (see chipFailures.ts /
   * lcoe.ts / nodeFailureModes.ts) and therefore drives fleet sizing and
   * lifecycle cost. Internal-only, never displayed directly -- see
   * resource_capacity_factor for the dashboard's "Resource capacity
   * factor" metric, which is a separate calculation that does NOT feed
   * this value or anything derived from it. See src/model/waverys.ts.
   */
  effective_sea_park_cf: number;
  /**
   * The dashboard's headline "Resource capacity factor" metric: useful
   * compute work actually available, relative to a theoretically perfect
   * continuous-full-power environment. "Useful work" is server power above
   * the fixed idle-power floor (CONST.server_idle_power_fraction of rated
   * payload) -- a genuine energy-average capacity factor (partial credit
   * for partial power), NOT the share-of-time metric that name colloquially
   * suggests (see rated_power_availability for that). Battery folded in via
   * the same lull-by-lull approximation as the other two metrics below, no
   * chronological state-of-charge simulation. Bounded to [0,1]. Deliberately
   * independent of effective_sea_park_cf above -- this is a reporting-only
   * metric and does not affect energy delivery, fleet sizing, or cost. See
   * src/model/waverys.ts.
   */
  resource_capacity_factor: number;
  /**
   * Secondary descriptive metric: share of historical time the full
   * installed compute payload can operate at 100% rated power (no partial
   * credit at all) -- what this dashboard used to label "Resource capacity
   * factor" before that name was reserved for the energy-average metric
   * above. Never called a "capacity factor" in code or UI copy. Same
   * lull-by-lull battery approximation, bounded to [0,1], reporting-only.
   */
  rated_power_availability: number;
  /**
   * Secondary descriptive metric: share of historical time there is enough
   * power to keep the servers powered at their idle requirement, even if
   * not enough to do any useful compute work. Its own, independent
   * lull-by-lull battery approximation against the (much lower) idle-power
   * threshold -- not jointly optimized with the other two metrics' battery
   * usage. Bounded to [0,1], reporting-only.
   */
  keepalive_availability: number;
  /**
   * LCOE-only electrical-output cap: equals pto_rating_kw (installed PTO
   * rating), NOT min(payload, PTO) like power_cap_kw. Power-system LCOE is
   * meant to be use-agnostic -- it measures what the generating platform can
   * supply, not what a possibly-undersized compute payload happens to draw
   * -- so a deliberately small payload must not shrink the LCOE denominator.
   * Used only by lcoe.ts; every compute-side calculation (fleet sizing,
   * lifecycle cost, chip failures, the three descriptive resource metrics
   * above) continues to use power_cap_kw unchanged. See src/model/lcoe.ts.
   */
  lcoe_power_cap_kw: number;
  /** Same role as full_output_flux_kw_per_m, but for lcoe_power_cap_kw -- LCOE-only. */
  lcoe_full_output_flux_kw_per_m: number;
  /** Same role as outbound_energy_kwh, but capped at lcoe_power_cap_kw -- LCOE-only. */
  lcoe_outbound_energy_kwh: number;
  /**
   * Same role as effective_sea_park_cf, but computed with the equipment cap
   * (and the "full power" threshold it normalizes against) set to
   * lcoe_power_cap_kw instead of power_cap_kw -- i.e. relative to installed
   * PTO rating rather than installed compute payload. LCOE-only; never fed
   * into fleet sizing, lifecycle cost, or the descriptive resource metrics.
   */
  lcoe_effective_sea_park_cf: number;
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
    /**
     * Three cost categories, each a genuine discounted present value (not an
     * approximation), summing exactly to present_value_total_node_fleet_cost_usd.
     * nodes = the full lifecycle cost of everything about a node except its
     * compute payload and workload data (capex, deployment logistics,
     * maintenance, failure/retirement -- i.e. initial_non_compute_physical_usd
     * plus non_compute_maintenance_failure_usd's PV, combined: there is no
     * separate "other opex" category, since every recurring non-compute cost
     * already belongs to nodes); chips = compute_and_replacement_usd's PV;
     * workload = workload_data_transfer_usd's PV.
     */
    present_value_nodes_cost_usd: number;
    present_value_chips_cost_usd: number;
    /** Discounted workload data-transfer cost (already included in present_value_total_node_fleet_cost_usd). */
    present_value_workload_data_transfer_cost_usd: number;
    lifecycle_cost_per_target_watt_usd: number;
    yearly_delivered_energy_mwh: number[]; // index 0 = year 0 .. T
  };
  /** Power-system LCOE ($/MWh) -- see LcoeResult. Not a levelized cost of delivered COMPUTE energy; do not use for compute-cost comparisons. */
  lcoe: LcoeResult;
}
