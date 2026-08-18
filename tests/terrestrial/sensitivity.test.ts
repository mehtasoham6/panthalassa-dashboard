import { describe, expect, it } from "vitest";
import { DEFAULT_TERRESTRIAL_INPUTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";

describe("refined-model monotonicity", () => {
  const base = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);

  it("higher PUE increases generation, gas, nameplate and lifecycle cost", () => {
    const high = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, pue: 1.40 });
    expect(high.capacity.ccgt_nameplate_capacity_mw).toBeGreaterThan(base.capacity.ccgt_nameplate_capacity_mw);
    expect(high.energy.annual_generated_electricity_mwh).toBeGreaterThan(base.energy.annual_generated_electricity_mwh);
    expect(high.energy.annual_natural_gas_mmbtu).toBeGreaterThan(base.energy.annual_natural_gas_mmbtu);
    expect(high.costs.total_lifecycle_cost_usd).toBeGreaterThan(base.costs.total_lifecycle_cost_usd);
    expect(high.lcoe.lcoe_usd_per_mwh).toBe(base.lcoe.lcoe_usd_per_mwh);
  });

  it("lower availability increases nameplate and fixed/capital cost without reducing delivered compute", () => {
    const low = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, power_system_availability: 0.75 });
    expect(low.capacity.ccgt_nameplate_capacity_mw).toBeGreaterThan(base.capacity.ccgt_nameplate_capacity_mw);
    expect(low.energy.annual_delivered_compute_mwh).toBe(base.energy.annual_delivered_compute_mwh);
    expect(low.costs.initial.ccgt_capex_usd).toBeGreaterThan(base.costs.initial.ccgt_capex_usd);
    expect(low.costs.total_lifecycle_cost_usd).toBeGreaterThan(base.costs.total_lifecycle_cost_usd);
  });

  it("scales linearly with target capacity apart from no discrete rounding", () => {
    const ten = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, target_capacity_gw: 10 });
    expect(ten.capacity.ccgt_nameplate_capacity_mw).toBeCloseTo(base.capacity.ccgt_nameplate_capacity_mw * 10, 8);
    expect(ten.costs.total_lifecycle_cost_usd).toBeCloseTo(base.costs.total_lifecycle_cost_usd * 10, 2);
    expect(ten.costs.lifecycle_cost_per_target_watt_usd).toBeCloseTo(base.costs.lifecycle_cost_per_target_watt_usd, 10);
  });

  it("higher compute failure hazard changes replacement cost, not delivered output", () => {
    const high = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, chip_failure_rate_annual: 0.10 });
    expect(high.energy.annual_delivered_compute_mwh).toBe(base.energy.annual_delivered_compute_mwh);
    const ratio = 0.10 / DEFAULT_TERRESTRIAL_INPUTS.chip_failure_rate_annual;
    expect(high.costs.annual_steady_state.compute_failure_replacement_usd).toBeCloseTo(
      base.costs.annual_steady_state.compute_failure_replacement_usd * ratio,
      4,
    );
  });
});
