/** Fixed configuration values (Appendix A.2). Not user-facing. */
export const CONST = {
  tug_distance_km: 50,
  tug_speed_km_per_day: 300,
  self_propulsion_speed_km_per_day: 48,
  payload_swap_dock_days: 1,
  node_maintenance_interval_years: 5,
  node_maintenance_dock_days: 7,
  end_to_end_efficiency: 0.85,
  pto_payload_multiplier: 1.5,
  // Revised per project decision -- was 0.70/0.20/0.07/0.03, originally
  // 0.7896/0.1961/0.01415/0.00014 in the public-model document.
  mode_2_weight: 0.65,
  mode_3_weight: 0.32,
  mode_4_weight: 0.02,
  mode_5_weight: 0.01,
  mode_2_repair_days: 7,
  mode_3_repair_days: 7,
  reference_hull_length_m: 85, // descriptive metadata only; not used in any formula
  reference_hull_diameter_m: 20,
  reference_hull_steel_mass_tonnes: 150,
  battery_pack_cost_usd_per_kwh: 100,
  battery_power_system_cost_usd_per_kw: 75,
  onboard_systems_cost_usd_per_node: 25_000,
  tug_cost_usd_per_day: 10_000,
  scheduled_node_maintenance_cost_fraction: 0.03,
  disabling_mechanical_repair_cost_usd: 50_000,
  mode_5_catastrophic_cost_usd: 2_000_000,
  node_retirement_processing_cost_fraction: 0.01,
  // GB transferred per (Mbps/kW of intensity) per kWh of delivered compute:
  // 1 Mbps * 3,600 s = 3,600 megabits = 450 MB = 0.45 GB per kWh-hour.
  workload_data_transfer_gb_per_mbps_kwh: 0.45,
  hours_per_year: 8760,
  days_per_year: 365,
} as const;
