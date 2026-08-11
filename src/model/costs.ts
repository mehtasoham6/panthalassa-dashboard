import { CONST } from "./constants.js";
import type { ChipFailureResult, DerivedQuantities, ModelInputs, ModelResult } from "./types.js";
import { averageRemainingLifeFraction } from "./remainingLife.js";
import { computeNodeUnitCosts } from "./nodeUnitCosts.js";

/**
 * Section 7 / Appendix A.5 cost model.
 *
 * Tug-cost deduplication (per resolved spec clarification): a combined
 * surprise/full-maintenance visit increments both the surprise-service
 * diagnostic count and the full-maintenance work count, but must only be
 * charged one physical round trip. The literal spec formulas
 * (`normal_tug_cost_usd` using payload-only + full-maintenance counts, and
 * `mode_1_2_tug_cost_usd` using the surprise-service count) would double-bill
 * a combined visit since both counts include it. Here, the Mode-1-driven
 * physical-trip charge is taken once from the chip module's deduplicated
 * ledger (`expected_mode_1_physical_tug_round_trips_per_position`), and the
 * Mode-2 tug charge is kept separate (Mode 2 is unrelated to the Mode-1
 * combined-visit overlap).
 */
export function computeCosts(
  inputs: ModelInputs,
  derived: DerivedQuantities,
  chip: ChipFailureResult,
  modeLosses: ModelResult["modeLosses"],
  N_fleet: number,
  node_generations: number,
  fleetDeliveredEnergyKwh: number,
): ModelResult["costs"] {
  // 7.1 Cost of one newly built node
  const { physical_node_cost_usd, compute_hardware_cost_usd, non_compute_node_cost_usd } = computeNodeUnitCosts(
    inputs,
    derived,
  );

  const total_planned_physical_node_cost_usd = physical_node_cost_usd * N_fleet * node_generations;

  // 7.2 Compute replacement: only capacity that has actually failed by
  // service time is replaced (continuous kW, no block granularity).
  const fleet_compute_replacement_cost_usd =
    chip.expected_failed_capacity_kw_replaced_per_position * inputs.compute_hardware_cost_usd_per_kw * N_fleet;

  const expected_total_loss_events_fleet =
    N_fleet * inputs.analysis_period_years * (modeLosses.mode_4_rate_annual + modeLosses.mode_5_rate_annual);

  // Modes 4/5 economic replacement cost is scaled by the node's average
  // remaining straight-line economic life (age resets each planned
  // generation): a loss near the end of its planned life substitutes for a
  // future generation purchase, so it costs less in expectation than
  // destroying a brand-new node. Applied identically to the compute and
  // non-compute pieces below so together they total (avg fraction) x one
  // full new node, never double-counted.
  const avgRemainingLifeFraction = averageRemainingLifeFraction(0, inputs.analysis_period_years, inputs.node_lifetime_years);
  const fleet_complete_payload_replacement_cost_usd =
    expected_total_loss_events_fleet * compute_hardware_cost_usd * avgRemainingLifeFraction;

  const total_compute_replacement_cost_usd =
    fleet_compute_replacement_cost_usd + fleet_complete_payload_replacement_cost_usd;

  // 7.3 / A.5 Non-compute maintenance and failure costs
  const tug_50km_leg_cost_usd = CONST.tug_cost_usd_per_day * derived.one_way_tug_days;

  const normal_tug_cost_usd =
    tug_50km_leg_cost_usd *
    N_fleet *
    (node_generations + 2 * chip.expected_mode_1_physical_tug_round_trips_per_position);

  const scheduled_node_maintenance_cost_usd =
    N_fleet *
    chip.scheduled_node_maintenance_event_count_per_position *
    CONST.scheduled_node_maintenance_cost_fraction *
    non_compute_node_cost_usd;

  const mode_1_2_tug_cost_usd =
    2 * tug_50km_leg_cost_usd * N_fleet * (inputs.analysis_period_years * modeLosses.mode_2_rate_annual);

  const mode_3_tug_cost_usd =
    N_fleet *
    inputs.analysis_period_years *
    modeLosses.mode_3_rate_annual *
    CONST.tug_cost_usd_per_day *
    ((2 * inputs.sea_park_distance_km) / CONST.tug_speed_km_per_day + derived.one_way_tug_days);

  const replacement_deployment_tug_cost_usd = expected_total_loss_events_fleet * tug_50km_leg_cost_usd;

  const unexpected_tug_cost_usd = mode_1_2_tug_cost_usd + mode_3_tug_cost_usd + replacement_deployment_tug_cost_usd;

  const mode_4_5_non_compute_replacement_cost_usd =
    expected_total_loss_events_fleet * non_compute_node_cost_usd * avgRemainingLifeFraction;

  const unexpected_mechanical_repair_cost_usd =
    CONST.disabling_mechanical_repair_cost_usd *
    N_fleet *
    inputs.analysis_period_years *
    (modeLosses.mode_2_rate_annual + modeLosses.mode_3_rate_annual);

  const mode_5_catastrophic_cost_usd_total =
    CONST.mode_5_catastrophic_cost_usd * N_fleet * inputs.analysis_period_years * modeLosses.mode_5_rate_annual;

  const node_retirement_cost_usd_total =
    N_fleet *
    Math.floor(inputs.analysis_period_years / inputs.node_lifetime_years) *
    CONST.node_retirement_processing_cost_fraction *
    non_compute_node_cost_usd;

  const total_non_compute_maintenance_failure_cost_usd =
    normal_tug_cost_usd +
    scheduled_node_maintenance_cost_usd +
    unexpected_tug_cost_usd +
    mode_4_5_non_compute_replacement_cost_usd +
    unexpected_mechanical_repair_cost_usd +
    mode_5_catastrophic_cost_usd_total +
    node_retirement_cost_usd_total;

  // 7.5 Workload data-transfer cost (recurring opex, not node capex): proportional
  // to fleet-wide productive delivered-compute energy over the whole period, so
  // no yearly breakdown is needed for the undiscounted total (only for its
  // present value -- see presentValue.ts). Docked, failed, or idle time earns
  // nothing, since fleetDeliveredEnergyKwh already nets those out.
  const total_workload_data_transferred_gb =
    CONST.workload_data_transfer_gb_per_mbps_kwh * inputs.workloadBandwidthIntensityMbpsPerKw * fleetDeliveredEnergyKwh;
  const total_workload_data_transfer_cost_usd = total_workload_data_transferred_gb * inputs.dataTransferCostPerGb;

  // 7.4 Total undiscounted lifecycle cost
  const total_node_fleet_cost_usd =
    total_planned_physical_node_cost_usd +
    total_compute_replacement_cost_usd +
    total_non_compute_maintenance_failure_cost_usd +
    total_workload_data_transfer_cost_usd;

  return {
    physical_node_cost_usd,
    non_compute_node_cost_usd,
    total_planned_physical_node_cost_usd,
    total_compute_replacement_cost_usd,
    total_non_compute_maintenance_failure_cost_usd,
    total_workload_data_transfer_cost_usd,
    total_workload_data_transferred_gb,
    total_node_fleet_cost_usd,
    buckets: {
      compute_and_replacement_usd: compute_hardware_cost_usd * N_fleet * node_generations + total_compute_replacement_cost_usd,
      initial_non_compute_physical_usd: non_compute_node_cost_usd * N_fleet * node_generations,
      non_compute_maintenance_failure_usd: total_non_compute_maintenance_failure_cost_usd,
      workload_data_transfer_usd: total_workload_data_transfer_cost_usd,
    },
    // Read-only exposure of already-computed intermediates (Section 7.3 / A.5
    // line items) -- no formula changes -- so presentation layers can build
    // their own categorizations without re-deriving cost math.
    lineItems: {
      compute_hardware_capex_usd: compute_hardware_cost_usd * N_fleet * node_generations,
      fleet_compute_replacement_cost_usd,
      fleet_complete_payload_replacement_cost_usd,
      normal_tug_cost_usd,
      scheduled_node_maintenance_cost_usd,
      unexpected_tug_cost_usd,
      mode_4_5_non_compute_replacement_cost_usd,
      unexpected_mechanical_repair_cost_usd,
      mode_5_catastrophic_cost_usd_total,
      node_retirement_cost_usd_total,
      workload_data_transfer_cost_usd: total_workload_data_transfer_cost_usd,
    },
  };
}
