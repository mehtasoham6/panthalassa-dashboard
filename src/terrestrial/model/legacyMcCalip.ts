import { MODEL_CONSTANTS } from "./defaults.js";
import type { LegacyMcCalipInputs, LegacyMcCalipResult } from "./types.js";

/**
 * Exact transcription of McCalip's public calculateTerrestrial() function.
 * This is intentionally not corrected and must never drive the refined UI.
 * It exists solely to prove that the package can reproduce the source model.
 */
export function calculateLegacyMcCalipTerrestrial(inputs: LegacyMcCalipInputs): LegacyMcCalipResult {
  const targetPowerMw = inputs.targetGW * 1_000;
  const targetPowerW = targetPowerMw * 1_000_000;
  const totalHours = inputs.years * MODEL_CONSTANTS.hours_per_year;

  const powerGenCostPerW = (inputs.gasTurbineCapexPerKW * inputs.pue) / 1_000;
  const powerGenCost = powerGenCostPerW * targetPowerW;
  const electricalCost = inputs.electricalCostPerW * targetPowerW;
  const mechanicalCost = inputs.mechanicalCostPerW * targetPowerW;
  const civilCost = inputs.civilCostPerW * targetPowerW;
  const networkCost = inputs.networkCostPerW * targetPowerW;
  const infraCapex = powerGenCost + electricalCost + mechanicalCost + civilCost + networkCost;
  const facilityCapexPerW =
    powerGenCostPerW +
    inputs.electricalCostPerW +
    inputs.mechanicalCostPerW +
    inputs.civilCostPerW +
    inputs.networkCostPerW;

  const energyMWh = targetPowerMw * totalHours * inputs.capacityFactor;
  const generationMWh = energyMWh * inputs.pue;
  const fuelCostPerMWh = (inputs.heatRateBtuKwh * inputs.gasPricePerMMBtu) / 1_000;
  const fuelCostTotal = fuelCostPerMWh * generationMWh;
  const totalCost = infraCapex + fuelCostTotal;
  const generationKWh = generationMWh * 1_000;
  const totalBtu = generationKWh * inputs.heatRateBtuKwh;

  return {
    powerGenCost,
    electricalCost,
    mechanicalCost,
    civilCost,
    networkCost,
    infraCapex,
    facilityCapexPerW,
    fuelCostPerMWh,
    fuelCostTotal,
    totalCost,
    energyMWh,
    generationMWh,
    costPerW: totalCost / targetPowerW,
    lcoe: totalCost / energyMWh,
    gasConsumptionBCF: totalBtu / 1_000 / 1_000_000_000,
    totalGenerationMW: targetPowerMw * inputs.pue,
  };
}
