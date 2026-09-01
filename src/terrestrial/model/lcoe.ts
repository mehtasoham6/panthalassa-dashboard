import { MODEL_CONSTANTS, TERRESTRIAL_POWER_SOURCE_SPECS } from "./defaults.js";
import { discount } from "./economics.js";
import type { TerrestrialLcoeResult, TerrestrialModelInputs } from "./types.js";

/**
 * Standalone power-system LCOE. It deliberately excludes compute hardware,
 * the data-center facility, PUE-dependent facility sizing, and workload
 * networking. The denominator is net electricity at the power plant's bus.
 *
 * For non-CCGT sources, battery capex/O&M (for the three storage-paired
 * technologies) is folded into this same single-horizon schedule at the
 * generation asset's own economic life -- a minor simplification, since
 * Lazard's storage project life (20 years) is actually shorter than every
 * renewable/geothermal facility life (25-35 years) here, so in reality the
 * battery would be replaced partway through. The main lifecycle-cost engine
 * (model.ts) does not make this simplification -- it discounts storage on
 * its own, correct 20-year horizon. This tile is a secondary, independent
 * metric (see its own "not for compute-cost comparisons" framing elsewhere
 * in the app), so the approximation is confined to this one display value.
 */
export function computeTerrestrialPowerSystemLcoe(inputs: TerrestrialModelInputs): TerrestrialLcoeResult {
  const isCcgt = inputs.power_source === "ccgt";
  const spec = TERRESTRIAL_POWER_SOURCE_SPECS[inputs.power_source];
  const life = isCcgt ? inputs.ccgt_economic_life_years : spec.facilityLifeYears;
  const yearlyCost = new Array<number>(life + 1).fill(0);
  const yearlyEnergy = new Array<number>(life + 1).fill(0);

  // Normalize to one kW of generation nameplate. This makes LCOE independent
  // of target scale and PUE, as a proper technology-level metric should be.
  const nameplateKw = 1;
  const capacityFactor = isCcgt ? inputs.power_system_availability : inputs.renewable_capacity_factor;
  const annualGenerationMwh = (nameplateKw * capacityFactor * MODEL_CONSTANTS.hours_per_year) / 1_000;

  let capexUsd: number;
  let annualFixedCostUsd: number;
  let annualVariableCostUsdPerMwh: number;

  if (isCcgt) {
    capexUsd = nameplateKw * inputs.ccgt_capex_usd_per_kw;
    const fuelUsdPerMwh =
      (MODEL_CONSTANTS.ccgt_heat_rate_btu_per_kwh_hhv / 1_000) * inputs.delivered_gas_price_usd_per_mmbtu;
    annualFixedCostUsd = nameplateKw * inputs.ccgt_fixed_om_usd_per_kw_year;
    annualVariableCostUsdPerMwh = MODEL_CONSTANTS.ccgt_variable_om_usd_per_mwh + fuelUsdPerMwh;
  } else {
    const storageKwh = spec.hasStorage ? nameplateKw * MODEL_CONSTANTS.renewable_storage_kwh_per_kw : 0;
    capexUsd = nameplateKw * inputs.renewable_capex_usd_per_kw + storageKwh * inputs.renewable_storage_capex_usd_per_kwh;
    annualFixedCostUsd = nameplateKw * inputs.renewable_fixed_om_usd_per_kw_year + storageKwh * MODEL_CONSTANTS.renewable_storage_om_usd_per_kwh;
    annualVariableCostUsdPerMwh = spec.hasVariableOm ? inputs.geothermal_variable_om_usd_per_mwh : 0;
  }

  yearlyCost[0] = capexUsd;
  for (let year = 1; year <= life; year++) {
    yearlyEnergy[year] = annualGenerationMwh;
    yearlyCost[year] = annualFixedCostUsd + annualGenerationMwh * annualVariableCostUsdPerMwh;
  }
  yearlyCost[life]! += capexUsd * MODEL_CONSTANTS.ccgt_decommissioning_fraction;

  let presentValueCost = 0;
  let presentValueEnergy = 0;
  for (let year = 0; year <= life; year++) {
    presentValueCost += discount(yearlyCost[year]!, inputs.real_discount_rate, year);
    presentValueEnergy += discount(yearlyEnergy[year]!, inputs.real_discount_rate, year);
  }

  return {
    lcoe_usd_per_mwh: presentValueCost / presentValueEnergy,
    lcoe_horizon_years: life,
    present_value_power_system_cost_usd: presentValueCost,
    present_value_generated_electricity_mwh: presentValueEnergy,
    yearly_power_system_cost_usd: yearlyCost,
    yearly_generated_electricity_mwh: yearlyEnergy,
  };
}
