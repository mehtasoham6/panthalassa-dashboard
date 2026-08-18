import { describe, expect, it } from "vitest";
import { DEFAULT_TERRESTRIAL_INPUTS, MODEL_CONSTANTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";

describe("power-system LCOE boundary", () => {
  const base = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);

  it("uses the CCGT economic life rather than the dashboard analysis period", () => {
    expect(base.lcoe.lcoe_horizon_years).toBe(30);
    expect(base.lcoe.yearly_power_system_cost_usd).toHaveLength(31);
    expect(base.lcoe.yearly_power_system_cost_usd[0]).toBe(2_300);
  });

  it("is independent of target, PUE, compute, facility, workload, and analysis-period inputs", () => {
    const changed = runTerrestrialModel({
      ...DEFAULT_TERRESTRIAL_INPUTS,
      target_capacity_gw: 20,
      analysis_period_years: 15,
      pue: 1.50,
      chip_failure_rate_annual: 0.10,
      compute_hardware_cost_usd_per_kw: 10_000,
      facility_capex_usd_per_it_watt: 16,
      workloadBandwidthIntensityMbpsPerKw: 0.10,
    });
    expect(changed.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
    expect(changed.lcoe.yearly_power_system_cost_usd).toEqual(base.lcoe.yearly_power_system_cost_usd);
    expect(changed.lcoe.yearly_generated_electricity_mwh).toEqual(base.lcoe.yearly_generated_electricity_mwh);
  });

  it("responds in the expected direction to every LCOE driver", () => {
    expect(runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, ccgt_capex_usd_per_kw: 2_600 }).lcoe.lcoe_usd_per_mwh)
      .toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
    expect(runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, delivered_gas_price_usd_per_mmbtu: 6 }).lcoe.lcoe_usd_per_mwh)
      .toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
    expect(runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, power_system_availability: 0.75 }).lcoe.lcoe_usd_per_mwh)
      .toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
    expect(runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, real_discount_rate: 0.10 }).lcoe.lcoe_usd_per_mwh)
      .toBeGreaterThan(base.lcoe.lcoe_usd_per_mwh);
  });

  it("charges decommissioning only at the economic-life boundary", () => {
    const schedule = base.lcoe.yearly_power_system_cost_usd;
    const life = base.lcoe.lcoe_horizon_years;
    const expectedDecommissioning =
      DEFAULT_TERRESTRIAL_INPUTS.ccgt_capex_usd_per_kw * MODEL_CONSTANTS.ccgt_decommissioning_fraction;
    const steadyStateYearCost = schedule[life - 1]!;
    expect(schedule[life]! - steadyStateYearCost).toBeCloseTo(expectedDecommissioning, 6);
  });
});
