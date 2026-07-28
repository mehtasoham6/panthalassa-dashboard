import { CONST } from "./constants.js";
import type { DerivedQuantities, ModelInputs } from "./types.js";
import { computeOutboundLegEnergyKwh } from "./energy.js";

/** Section 2.1 and Appendix A.3: quantities derived once from the sliders. */
export function computeDerived(inputs: ModelInputs): DerivedQuantities {
  const capture_width_ratio = (1.3 * inputs.hull_diameter_m + 5.6) / 100;

  const best_effort_capacity_kw = inputs.hotSpareShare * inputs.payload_rating_kw;
  const guaranteed_capacity_kw = inputs.payload_rating_kw - best_effort_capacity_kw;

  const self_propulsion_distance_km = Math.max(
    0,
    inputs.sea_park_distance_km - CONST.tug_distance_km,
  );
  const one_way_tug_days = CONST.tug_distance_km / CONST.tug_speed_km_per_day;
  const one_way_self_propulsion_days =
    self_propulsion_distance_km / CONST.self_propulsion_speed_km_per_day;
  const one_way_journey_days = one_way_tug_days + one_way_self_propulsion_days;

  const analysis_period_hours = CONST.hours_per_year * inputs.analysis_period_years;

  const pto_rating_kw = CONST.pto_payload_multiplier * inputs.payload_rating_kw;
  const power_cap_kw = Math.min(inputs.payload_rating_kw, pto_rating_kw);

  const capture_coefficient =
    inputs.hull_diameter_m * capture_width_ratio * CONST.end_to_end_efficiency;
  const full_output_flux_kw_per_m = power_cap_kw / capture_coefficient;

  const outbound_days = one_way_tug_days + one_way_self_propulsion_days;
  const outbound_energy_kwh = computeOutboundLegEnergyKwh({
    one_way_tug_days,
    one_way_self_propulsion_days,
    power_cap_kw,
    capture_coefficient,
    full_output_flux_kw_per_m,
  });

  return {
    capture_width_ratio,
    best_effort_capacity_kw,
    guaranteed_capacity_kw,
    self_propulsion_distance_km,
    one_way_tug_days,
    one_way_self_propulsion_days,
    one_way_journey_days,
    analysis_period_hours,
    pto_rating_kw,
    power_cap_kw,
    full_output_flux_kw_per_m,
    capture_coefficient,
    outbound_days,
    outbound_energy_kwh,
  };
}
