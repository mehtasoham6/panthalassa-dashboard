import { CONST } from "./constants.js";
import type { ChipFailureResult, DerivedQuantities, ModelInputs, ModelResult } from "./types.js";
import { remainingLifeIntegral } from "./remainingLife.js";
import { generationCapitalFraction } from "./generationCapital.js";

/**
 * Section 8 present value / unit-cost outputs, plus the annual cost/energy
 * allocation used to compute them (resolved spec clarification #2):
 *  - initial node generation (generation 0) -> cost year 0, always charged in
 *    full; later generation g -> year g*node_lifetime_years, charged only its
 *    generationCapitalFraction share of a full generation's capital cost
 *    (see generationCapital.ts) -- no terminal residual credit anywhere;
 *  - Compute-service costs/energy (surprise trips + fixed maintenance) ->
 *    allocated via the chip module's own yearly breakdown (exact event/
 *    delivery timing from the schedule walk);
 *  - Modes 2-5 costs (and their output loss) -> spread pro-rata across
 *    years 1..T (constant-rate exposure);
 *  - this allocation affects PRESENT VALUE only -- it is constructed so that
 *    summing the yearly buckets reproduces the undiscounted totals exactly
 *    (verified as a regression invariant, not just asserted here).
 *
 * Every cost term is tagged into one of three categories -- nodes (all
 * non-compute physical costs: capex, deployment logistics, maintenance,
 * failure/retirement -- i.e. the full lifecycle cost of everything about a
 * node except its compute payload and workload data), chips (compute capex
 * + all compute/payload replacement), workload data -- so each category's
 * discounted total is a genuine present value, not an approximation, and
 * the three sum exactly to present_value_total_node_fleet_cost_usd (by
 * linearity of discounting; verified as a regression invariant). There is
 * deliberately no separate "other opex" category: every recurring cost
 * traces back to nodes, chips, or workload, so a fourth catch-all bucket
 * would always be empty.
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
  const yearlyNodes: number[] = new Array(numBuckets).fill(0);
  const yearlyChips: number[] = new Array(numBuckets).fill(0);
  const yearlyWorkload: number[] = new Array(numBuckets).fill(0);
  const yearlyEnergyMwh: number[] = new Array(numBuckets).fill(0);

  const tug_50km_leg_cost_usd = inputs.tugCostUsdPerDay * derived.one_way_tug_days;
  const compute_capex_per_node_usd = costs.physical_node_cost_usd - costs.non_compute_node_cost_usd;

  // 1. Node generation purchases (+ each generation's initial deployment tug
  // leg). Generation 0 (the initial fleet) is always charged in full at year
  // 0. Later planned generations are charged their fraction of a full
  // generation's capital cost (see generationCapital.ts) at their own
  // purchase time, discounted from there -- not charged in full and credited
  // back later. The deployment tug leg is a discrete logistics event for
  // that node, so it's tagged nodes alongside the capex it accompanies.
  // physical_node_cost_usd is split into its non-compute (nodes) and compute
  // (chips) pieces so the two categories stay separated all the way through.
  for (let g = 0; g < node_generations; g++) {
    const idx = Math.min(g * inputs.node_lifetime_years, Tend);
    const fraction = generationCapitalFraction(g, inputs.analysis_period_years, inputs.node_lifetime_years);
    yearlyNodes[idx]! += N_fleet * costs.non_compute_node_cost_usd * fraction;
    yearlyChips[idx]! += N_fleet * compute_capex_per_node_usd * fraction;
    yearlyNodes[idx]! += N_fleet * tug_50km_leg_cost_usd;
  }

  // 2. Compute-service-driven costs and delivered energy, via the chip module's yearly breakdown.
  for (let y = 1; y <= Tend; y++) {
    const i = y - 1;
    yearlyChips[y]! += chip.yearly_failed_capacity_kw_replaced[i]! * inputs.compute_hardware_cost_usd_per_kw * N_fleet;
    yearlyNodes[y]! +=
      chip.yearly_scheduled_full_maintenance_events[i]! *
      N_fleet *
      CONST.scheduled_node_maintenance_cost_fraction *
      costs.non_compute_node_cost_usd;
    yearlyNodes[y]! += 2 * tug_50km_leg_cost_usd * N_fleet * chip.yearly_mode_1_tug_round_trips[i]!;
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
  // chip failures and Modes 2-5 losses).
  for (let y = 1; y <= Tend; y++) {
    const annualFleetDeliveredComputeKwh = yearlyEnergyMwh[y]! * 1_000;
    const annualWorkloadDataGb =
      CONST.workload_data_transfer_gb_per_mbps_kwh * inputs.workloadBandwidthIntensityMbpsPerKw * annualFleetDeliveredComputeKwh;
    const annualWorkloadTransferCost = annualWorkloadDataGb * inputs.dataTransferCostPerGb;
    yearlyWorkload[y]! += annualWorkloadTransferCost;
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
    inputs.tugCostUsdPerDay *
    ((2 * inputs.sea_park_distance_km) / CONST.tug_speed_km_per_day + derived.one_way_tug_days);
  const replacement_deployment_tug_cost_usd = expectedTotalLossEventsFleet * tug_50km_leg_cost_usd;
  // Modes 4/5 full-node replacement cost is NOT part of the uniform spread
  // below -- it's allocated year-by-year against the remaining-economic-life
  // factor instead (same total-loss event rate, but front-loaded since the
  // factor decays within each planned generation) -- see the loop after
  // this block. Tug/logistics and catastrophic-cleanup costs are unrelated
  // to node age and stay uniformly spread; all of this uniform spread is
  // non-compute, so it's tagged nodes.
  const unexpected_mechanical_repair_cost_usd =
    inputs.mode23RepairCostUsd *
    N_fleet *
    inputs.analysis_period_years *
    (modeLosses.mode_2_rate_annual + modeLosses.mode_3_rate_annual);
  const mode_5_catastrophic_cost_usd_total =
    CONST.mode_5_catastrophic_cost_usd * N_fleet * inputs.analysis_period_years * modeLosses.mode_5_rate_annual;

  const uniformRateTotal =
    mode_2_tug_cost_usd +
    mode_3_tug_cost_usd +
    replacement_deployment_tug_cost_usd +
    unexpected_mechanical_repair_cost_usd +
    mode_5_catastrophic_cost_usd_total;
  const uniformPerYear = uniformRateTotal / Tend;
  for (let y = 1; y <= Tend; y++) {
    yearlyNodes[y]! += uniformPerYear;
  }

  // Modes 4/5 full-node replacement cost, allocated per year using the exact
  // average remaining-life factor over that year (age resets each planned
  // generation). Summed across all years this reproduces
  // expectedTotalLossEventsFleet * fullNodeCost * avgRemainingLifeFraction
  // exactly, matching costs.ts's undiscounted total. The compute piece is
  // chips; the non-compute piece is nodes.
  const totalLossRatePerYearFleet = N_fleet * (modeLosses.mode_4_rate_annual + modeLosses.mode_5_rate_annual);
  for (let y = 1; y <= Tend; y++) {
    const yearRemainingLifeIntegral = remainingLifeIntegral(y - 1, y, inputs.node_lifetime_years);
    yearlyChips[y]! += totalLossRatePerYearFleet * compute_hardware_cost_usd * yearRemainingLifeIntegral;
    yearlyNodes[y]! += totalLossRatePerYearFleet * costs.non_compute_node_cost_usd * yearRemainingLifeIntegral;
  }

  // 4. Node retirement: credited at each completed-lifetime boundary year (rare; zero at both worked-example defaults).
  const completedGenerations = Math.floor(inputs.analysis_period_years / inputs.node_lifetime_years);
  if (completedGenerations > 0) {
    const perGenRetirementUsd = N_fleet * CONST.node_retirement_processing_cost_fraction * costs.non_compute_node_cost_usd;
    for (let g = 1; g <= completedGenerations; g++) {
      const idx = Math.min(g * inputs.node_lifetime_years, Tend);
      yearlyNodes[idx]! += perGenRetirementUsd;
    }
  }

  // Combine the three category schedules back into the single yearly total
  // (byte-for-byte the same numbers the old single-accumulator version
  // produced -- this is a pure reorganization, not a formula change).
  const yearlyCost: number[] = new Array(numBuckets).fill(0);
  for (let t = 0; t < numBuckets; t++) {
    yearlyCost[t] = yearlyNodes[t]! + yearlyChips[t]! + yearlyWorkload[t]!;
  }

  // Present value and unit-cost outputs. (No levelized-cost-of-delivered-
  // compute metric here -- LCOE is now a separate, compute-agnostic
  // power-system calculation; see lcoe.ts.)
  const r = inputs.real_discount_rate;
  function presentValueOf(schedule: number[]): number {
    let total = 0;
    for (let t = 0; t < numBuckets; t++) {
      total += schedule[t]! / Math.pow(1 + r, t);
    }
    return total;
  }
  const presentValueNodes = presentValueOf(yearlyNodes);
  const presentValueChips = presentValueOf(yearlyChips);
  const presentValueWorkload = presentValueOf(yearlyWorkload);
  // Sum of the three categories, not a fresh discount pass over yearlyCost --
  // identical by linearity, and keeps the "parts sum to the total" invariant
  // true by construction rather than by coincidence.
  const presentValueTotal = presentValueNodes + presentValueChips + presentValueWorkload;

  const lifecycle_cost_per_target_watt_usd = presentValueTotal / (inputs.target_capacity_gw * 1_000_000_000);

  return {
    yearly_cost_usd: yearlyCost,
    present_value_total_node_fleet_cost_usd: presentValueTotal,
    present_value_nodes_cost_usd: presentValueNodes,
    present_value_chips_cost_usd: presentValueChips,
    present_value_workload_data_transfer_cost_usd: presentValueWorkload,
    lifecycle_cost_per_target_watt_usd,
    yearly_delivered_energy_mwh: yearlyEnergyMwh,
  };
}
