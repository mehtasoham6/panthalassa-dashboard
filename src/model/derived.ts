import { CONST } from "./constants.js";
import type { DerivedQuantities, ModelInputs } from "./types.js";
import { outboundLegSegments, processSegments, type BatteryState } from "./energy.js";
import { effectiveSeaParkCF, effectiveResourceCapacityFactor } from "./waverys.js";

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
  // Every departure from port starts with a fully charged battery (see
  // chipFailures.ts's per-departure reset), so the reference outbound leg
  // used by Modes 2-5 (a single redeployment trip, credited back against
  // each failure event) reflects that same fresh-battery assist during the
  // initial weak-wave ramp -- not a pure, battery-blind wave calculation.
  const battery_capacity_kwh = inputs.payload_rating_kw * inputs.battery_duration_hours;
  const departureBattery: BatteryState = { socKwh: battery_capacity_kwh };
  const outbound_energy_kwh = processSegments(
    outboundLegSegments({
      one_way_tug_days,
      one_way_self_propulsion_days,
      power_cap_kw,
      capture_coefficient,
      full_output_flux_kw_per_m,
    }),
    departureBattery,
    battery_capacity_kwh,
  ).deliveredEnergyKwh;

  // Copernicus WAVERYS sea-park wave-resource capacity factor (Section 3.1
  // extension): effective_sea_park_cf is the original energy-average
  // formula and is what actually schedules sea-park energy (see
  // chipFailures.ts/lcoe.ts/nodeFailureModes.ts) -- unchanged model logic,
  // so battery duration affects fleet sizing/cost exactly as it always
  // has. resource_capacity_factor is a separate, share-of-time "full rated
  // output or not" metric (lull-by-lull battery approximation, see
  // waverys.ts) used ONLY for the dashboard's "Resource capacity factor"
  // display tile -- it intentionally does not feed energy delivery/fleet
  // sizing/cost.
  const seaParkResourceParams = {
    captureCoefficient: capture_coefficient,
    powerCapKw: power_cap_kw,
    payloadRatingKw: inputs.payload_rating_kw,
  };
  const effective_sea_park_cf = effectiveSeaParkCF(seaParkResourceParams, battery_capacity_kwh);
  const resource_capacity_factor = effectiveResourceCapacityFactor(seaParkResourceParams, battery_capacity_kwh);

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
    effective_sea_park_cf,
    resource_capacity_factor,
  };
}
