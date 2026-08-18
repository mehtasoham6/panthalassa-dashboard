import { MODEL_CONSTANTS } from "./defaults.js";
import { discount } from "./economics.js";
import type { TerrestrialLcoeResult, TerrestrialModelInputs } from "./types.js";

/**
 * Standalone power-system LCOE. It deliberately excludes compute hardware,
 * the data-center facility, PUE-dependent facility sizing, and workload
 * networking. The denominator is net electricity at the CCGT plant bus.
 */
export function computeTerrestrialPowerSystemLcoe(inputs: TerrestrialModelInputs): TerrestrialLcoeResult {
  const life = inputs.ccgt_economic_life_years;
  const yearlyCost = new Array<number>(life + 1).fill(0);
  const yearlyEnergy = new Array<number>(life + 1).fill(0);

  // Normalize to one kW of CCGT nameplate. This makes LCOE independent of
  // target scale and PUE, as a proper technology-level metric should be.
  const nameplateKw = 1;
  const capexUsd = nameplateKw * inputs.ccgt_capex_usd_per_kw;
  const annualGenerationMwh =
    (nameplateKw * inputs.power_system_availability * MODEL_CONSTANTS.hours_per_year) / 1_000;
  const fuelUsdPerMwh =
    (MODEL_CONSTANTS.ccgt_heat_rate_btu_per_kwh_hhv / 1_000) * inputs.delivered_gas_price_usd_per_mmbtu;

  yearlyCost[0] = capexUsd;
  for (let year = 1; year <= life; year++) {
    yearlyEnergy[year] = annualGenerationMwh;
    yearlyCost[year] =
      nameplateKw * inputs.ccgt_fixed_om_usd_per_kw_year +
      annualGenerationMwh * (MODEL_CONSTANTS.ccgt_variable_om_usd_per_mwh + fuelUsdPerMwh);
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
