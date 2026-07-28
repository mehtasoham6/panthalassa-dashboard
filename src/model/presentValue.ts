import { CONST } from "./constants.js";
import type { ChipFailureResult, DerivedQuantities, ModelInputs, ModelResult } from "./types.js";

/**
 * Section 8 present value / unit-cost outputs, plus the annual cost/energy
 * allocation used to compute them (resolved spec clarification #2):
 *  - initial node generation -> cost year 0; later generations -> year
 *    (g-1)*node_lifetime_years;
 *  - Compute-service costs/energy (surprise trips + fixed maintenance) ->
 *    allocated via the chip module's own yearly breakdown (exact event/
 *    delivery timing from the schedule walk);
 *  - Modes 2-5 costs (and their output loss) -> spread pro-rata across
 *    years 1..T (constant-rate exposure);
 *  - this allocation affects PRESENT VALUE only -- it is constructed so that
 *    summing the yearly buckets reproduces the undiscounted totals exactly
 *    (verified as a regression invariant, not just asserted here).
 */
export function computePresentValueAndUnitCosts(
  inputs: ModelInputs,
  derived: DerivedQuantities,
  chip: ChipFailureResult,
  modeLosses: ModelResult["modeLosses"],
  costs: ModelResult["costs"],
  N_fleet: number,
  node_generations: number,
): ModelResult["presentValue"] {
  const Tend = inputs.analysis_period_years;
  const numBuckets = Tend + 1; // cost years 0..Tend
  const yearlyCost: number[] = new Array(numBuckets).fill(0);
  const yearlyEnergyMwh: number[] = new Array(numBuckets).fill(0);

  const tug_50km_leg_cost_usd = CONST.tug_cost_usd_per_day * derived.one_way_tug_days;

  // 1. Node generation purchases (+ each generation's initial deployment tug leg).
  for (let g = 0; g < node_generations; g++) {
    const idx = Math.min(g * inputs.node_lifetime_years, Tend);
    yearlyCost[idx]! += N_fleet * costs.physical_node_cost_usd;
    yearlyCost[idx]! += N_fleet * tug_50km_leg_cost_usd;
  }

  // 2. Compute-service-driven costs and delivered energy, via the chip module's yearly breakdown.
  for (let y = 1; y <= Tend; y++) {
    const i = y - 1;
    yearlyCost[y]! += chip.yearly_failed_capacity_kw_replaced[i]! * inputs.compute_hardware_cost_usd_per_kw * N_fleet;
    yearlyCost[y]! +=
      chip.yearly_scheduled_full_maintenance_events[i]! *
      N_fleet *
      CONST.scheduled_node_maintenance_cost_fraction *
      costs.non_compute_node_cost_usd;
    yearlyCost[y]! += 2 * tug_50km_leg_cost_usd * N_fleet * chip.yearly_mode_1_tug_round_trips[i]!;
    // chip.yearly_delivered_energy_kwh is per operating slot; scale to fleet-wide for the levelized-cost denominator.
    yearlyEnergyMwh[y]! += (chip.yearly_delivered_energy_kwh[i]! * N_fleet) / 1_000;
  }

  // 3. Modes 2-5: uniform-rate costs and output loss, pro-rated across years 1..Tend.
  // total_modes_2_5_loss_kwh is per operating slot; scale to fleet-wide.
  const modeLossPerYearMwh = (modeLosses.total_modes_2_5_loss_kwh * N_fleet) / 1_000 / Tend;
  for (let y = 1; y <= Tend; y++) {
    yearlyEnergyMwh[y]! -= modeLossPerYearMwh;
  }

  // 3.5. Workload data-transfer cost, per year, proportional to that year's
  // net fleet-wide delivered compute energy (yearlyEnergyMwh already nets out
  // chip failures and Modes 2-5 losses). Tracked alongside its own present
  // value for direct reporting (already included in presentValueTotal below
  // once folded into yearlyCost).
  const r0 = inputs.real_discount_rate;
  let presentValueWorkload = 0;
  for (let y = 1; y <= Tend; y++) {
    const annualFleetDeliveredComputeKwh = yearlyEnergyMwh[y]! * 1_000;
    const annualWorkloadDataGb =
      CONST.workload_data_transfer_gb_per_mbps_kwh * inputs.workloadBandwidthIntensityMbpsPerKw * annualFleetDeliveredComputeKwh;
    const annualWorkloadTransferCost = annualWorkloadDataGb * inputs.dataTransferCostPerGb;
    yearlyCost[y]! += annualWorkloadTransferCost;
    presentValueWorkload += annualWorkloadTransferCost / Math.pow(1 + r0, y);
  }

  const expectedTotalLossEventsFleet =
    N_fleet * inputs.analysis_period_years * (modeLosses.mode_4_rate_annual + modeLosses.mode_5_rate_annual);
  const compute_hardware_cost_usd = inputs.payload_rating_kw * inputs.compute_hardware_cost_usd_per_kw;

  const mode_2_tug_cost_usd =
    2 * tug_50km_leg_cost_usd * N_fleet * (inputs.analysis_period_years * modeLosses.mode_2_rate_annual);
  const mode_3_tug_cost_usd =
    N_fleet *
    inputs.analysis_period_years *
    modeLosses.mode_3_rate_annual *
    CONST.tug_cost_usd_per_day *
    ((2 * inputs.sea_park_distance_km) / CONST.tug_speed_km_per_day + derived.one_way_tug_days);
  const replacement_deployment_tug_cost_usd = expectedTotalLossEventsFleet * tug_50km_leg_cost_usd;
  const fleet_complete_payload_replacement_cost_usd = expectedTotalLossEventsFleet * compute_hardware_cost_usd;
  const mode_4_5_non_compute_replacement_cost_usd = expectedTotalLossEventsFleet * costs.non_compute_node_cost_usd;
  const unexpected_mechanical_repair_cost_usd =
    CONST.disabling_mechanical_repair_cost_usd *
    N_fleet *
    inputs.analysis_period_years *
    (modeLosses.mode_2_rate_annual + modeLosses.mode_3_rate_annual);
  const mode_5_catastrophic_cost_usd_total =
    CONST.mode_5_catastrophic_cost_usd * N_fleet * inputs.analysis_period_years * modeLosses.mode_5_rate_annual;

  const uniformRateTotal =
    mode_2_tug_cost_usd +
    mode_3_tug_cost_usd +
    replacement_deployment_tug_cost_usd +
    fleet_complete_payload_replacement_cost_usd +
    mode_4_5_non_compute_replacement_cost_usd +
    unexpected_mechanical_repair_cost_usd +
    mode_5_catastrophic_cost_usd_total;
  const uniformPerYear = uniformRateTotal / Tend;
  for (let y = 1; y <= Tend; y++) {
    yearlyCost[y]! += uniformPerYear;
  }

  // 4. Node retirement: credited at each completed-lifetime boundary year (rare; zero at both worked-example defaults).
  const completedGenerations = Math.floor(inputs.analysis_period_years / inputs.node_lifetime_years);
  if (completedGenerations > 0) {
    const perGenRetirementUsd = N_fleet * CONST.node_retirement_processing_cost_fraction * costs.non_compute_node_cost_usd;
    for (let g = 1; g <= completedGenerations; g++) {
      const idx = Math.min(g * inputs.node_lifetime_years, Tend);
      yearlyCost[idx]! += perGenRetirementUsd;
    }
  }

  // Present value and unit-cost outputs
  const r = inputs.real_discount_rate;
  let presentValueTotal = 0;
  let discountedEnergyMwh = 0;
  for (let t = 0; t < numBuckets; t++) {
    const factor = Math.pow(1 + r, t);
    presentValueTotal += yearlyCost[t]! / factor;
    discountedEnergyMwh += yearlyEnergyMwh[t]! / factor;
  }

  const lifecycle_cost_per_target_watt_usd =
    costs.total_node_fleet_cost_usd / (inputs.target_capacity_gw * 1_000_000_000);
  const levelized_cost_of_delivered_compute_energy_usd_per_mwh = presentValueTotal / discountedEnergyMwh;

  return {
    yearly_cost_usd: yearlyCost,
    present_value_total_node_fleet_cost_usd: presentValueTotal,
    present_value_workload_data_transfer_cost_usd: presentValueWorkload,
    lifecycle_cost_per_target_watt_usd,
    yearly_delivered_energy_mwh: yearlyEnergyMwh,
    levelized_cost_of_delivered_compute_energy_usd_per_mwh,
  };
}
