import { CONST } from "./constants.js";
import type { DerivedQuantities, ModelInputs, ModelResult } from "./types.js";

/** Section 4.2: Modes 2-5 (aggregate non-chip node-failure losses). */
export function computeModeLosses(
  inputs: ModelInputs,
  derived: DerivedQuantities,
): ModelResult["modeLosses"] {
  const mode_2_rate_annual = inputs.node_failure_rate_annual * CONST.mode_2_weight;
  const mode_3_rate_annual = inputs.node_failure_rate_annual * CONST.mode_3_weight;
  const mode_4_rate_annual = inputs.node_failure_rate_annual * CONST.mode_4_weight;
  const mode_5_rate_annual = inputs.node_failure_rate_annual * CONST.mode_5_weight;

  const outboundDays = derived.outbound_days;
  const outboundEnergyKwh = derived.outbound_energy_kwh;
  const returnDays = derived.one_way_journey_days;
  const powerCapKw = derived.power_cap_kw;

  const mode_2_loss_per_event_kwh =
    24 * powerCapKw * (returnDays + CONST.mode_2_repair_days + outboundDays) - outboundEnergyKwh;

  const tugDispatchDays = inputs.sea_park_distance_km / CONST.tug_speed_km_per_day;
  const towBackDays = inputs.sea_park_distance_km / CONST.tug_speed_km_per_day;
  const mode_3_loss_per_event_kwh =
    24 * powerCapKw * (tugDispatchDays + towBackDays + CONST.mode_3_repair_days + outboundDays) -
    outboundEnergyKwh;

  const mode_4_loss_per_event_kwh = 24 * powerCapKw * outboundDays - outboundEnergyKwh;
  const mode_5_loss_per_event_kwh = mode_4_loss_per_event_kwh;

  const expectedEvents = (rateAnnual: number) => inputs.analysis_period_years * rateAnnual;

  const mode_2_loss_kwh = expectedEvents(mode_2_rate_annual) * mode_2_loss_per_event_kwh;
  const mode_3_loss_kwh = expectedEvents(mode_3_rate_annual) * mode_3_loss_per_event_kwh;
  const mode_4_loss_kwh = expectedEvents(mode_4_rate_annual) * mode_4_loss_per_event_kwh;
  const mode_5_loss_kwh = expectedEvents(mode_5_rate_annual) * mode_5_loss_per_event_kwh;

  return {
    mode_2_loss_kwh,
    mode_3_loss_kwh,
    mode_4_loss_kwh,
    mode_5_loss_kwh,
    total_modes_2_5_loss_kwh: mode_2_loss_kwh + mode_3_loss_kwh + mode_4_loss_kwh + mode_5_loss_kwh,
    mode_2_rate_annual,
    mode_3_rate_annual,
    mode_4_rate_annual,
    mode_5_rate_annual,
  };
}
