import type { TerrestrialModelInputs } from "./types.js";

function requireFinite(name: keyof TerrestrialModelInputs, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function requireNonNegative(name: keyof TerrestrialModelInputs, value: number): void {
  requireFinite(name, value);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
}

function requirePositive(name: keyof TerrestrialModelInputs, value: number): void {
  requireFinite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`);
}

function requirePositiveInteger(name: keyof TerrestrialModelInputs, value: number): void {
  requirePositive(name, value);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer number of years`);
}

export function validateTerrestrialInputs(inputs: TerrestrialModelInputs): void {
  requirePositive("target_capacity_gw", inputs.target_capacity_gw);
  requirePositiveInteger("analysis_period_years", inputs.analysis_period_years);
  requireFinite("real_discount_rate", inputs.real_discount_rate);
  if (inputs.real_discount_rate <= -1) throw new RangeError("real_discount_rate must be greater than -100%");

  requireNonNegative("chip_failure_rate_annual", inputs.chip_failure_rate_annual);
  requireNonNegative("compute_hardware_cost_usd_per_kw", inputs.compute_hardware_cost_usd_per_kw);
  requireNonNegative("workloadBandwidthIntensityMbpsPerKw", inputs.workloadBandwidthIntensityMbpsPerKw);

  requireFinite("pue", inputs.pue);
  if (inputs.pue < 1) throw new RangeError("pue cannot be less than 1.0");

  requireFinite("power_system_availability", inputs.power_system_availability);
  if (inputs.power_system_availability <= 0 || inputs.power_system_availability > 1) {
    throw new RangeError("power_system_availability must be in (0, 1]");
  }

  requireNonNegative("ccgt_capex_usd_per_kw", inputs.ccgt_capex_usd_per_kw);
  requireNonNegative("delivered_gas_price_usd_per_mmbtu", inputs.delivered_gas_price_usd_per_mmbtu);
  requireNonNegative("ccgt_fixed_om_usd_per_kw_year", inputs.ccgt_fixed_om_usd_per_kw_year);
  requirePositiveInteger("ccgt_economic_life_years", inputs.ccgt_economic_life_years);

  requireNonNegative("facility_capex_usd_per_it_watt", inputs.facility_capex_usd_per_it_watt);
}
