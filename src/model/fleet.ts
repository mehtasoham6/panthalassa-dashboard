import type { ChipFailureResult, ModelInputs, ModelResult } from "./types.js";

/** Section 5: how many operating node slots are needed to meet the target. */
export function computeFleetSizing(
  inputs: ModelInputs,
  chip: ChipFailureResult,
  totalModes2to5LossKwh: number,
): Pick<
  ModelResult,
  "delivered_energy_kwh" | "expected_delivered_energy_per_position_mw_years" | "target_energy_mw_years" | "N_fleet"
> {
  const delivered_energy_kwh = chip.chip_adjusted_energy_kwh - totalModes2to5LossKwh;
  const expected_delivered_energy_per_position_mw_years = delivered_energy_kwh / (1_000 * 8_760);
  const target_energy_mw_years = 1_000 * inputs.target_capacity_gw * inputs.analysis_period_years;
  const N_fleet = Math.ceil(target_energy_mw_years / expected_delivered_energy_per_position_mw_years);

  return {
    delivered_energy_kwh,
    expected_delivered_energy_per_position_mw_years,
    target_energy_mw_years,
    N_fleet,
  };
}

/** Section 6: how many physical nodes and replacement components must be purchased. */
export function computePurchases(
  inputs: ModelInputs,
  N_fleet: number,
): { node_generations: number; planned_node_purchases: number } {
  const node_generations = Math.ceil(inputs.analysis_period_years / inputs.node_lifetime_years);
  const planned_node_purchases = N_fleet * node_generations;
  return { node_generations, planned_node_purchases };
}
