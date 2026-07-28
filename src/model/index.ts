import { computeDerived } from "./derived.js";
import { computeChipFailures } from "./chipFailures.js";
import { computeModeLosses } from "./nodeFailureModes.js";
import { computeFleetSizing, computePurchases } from "./fleet.js";
import { computeCosts } from "./costs.js";
import { computePresentValueAndUnitCosts } from "./presentValue.js";
import type { ModelInputs, ModelResult } from "./types.js";

export * from "./types.js";
export { CONST } from "./constants.js";

export function runModel(inputs: ModelInputs): ModelResult {
  const derived = computeDerived(inputs);
  const chip = computeChipFailures(inputs, derived);
  const modeLosses = computeModeLosses(inputs, derived);

  const { delivered_energy_kwh, expected_delivered_energy_per_position_mw_years, target_energy_mw_years, N_fleet } =
    computeFleetSizing(inputs, chip, modeLosses.total_modes_2_5_loss_kwh);

  const { node_generations, planned_node_purchases } = computePurchases(inputs, N_fleet);

  const fleetDeliveredEnergyKwh = N_fleet * delivered_energy_kwh;
  const costs = computeCosts(inputs, derived, chip, modeLosses, N_fleet, node_generations, fleetDeliveredEnergyKwh);

  const presentValue = computePresentValueAndUnitCosts(
    inputs,
    derived,
    chip,
    modeLosses,
    costs,
    N_fleet,
    node_generations,
  );

  return {
    inputs,
    derived,
    chip,
    modeLosses,
    delivered_energy_kwh,
    expected_delivered_energy_per_position_mw_years,
    target_energy_mw_years,
    N_fleet,
    node_generations,
    planned_node_purchases,
    costs,
    presentValue,
  };
}
