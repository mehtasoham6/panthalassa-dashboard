import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  DEFAULT_TERRESTRIAL_INPUTS,
  runTerrestrialModel,
  type TerrestrialArchitectureInputs,
} from "../../src/terrestrial/model/index.js";
import { ALL_TERRESTRIAL_SLIDERS } from "../../src/terrestrial/integration/index.js";

function expectFiniteAndReconciled(inputs: typeof DEFAULT_TERRESTRIAL_INPUTS): void {
  const result = runTerrestrialModel(inputs);
  const scalars = [
    result.capacity.ccgt_nameplate_capacity_mw,
    result.energy.annual_generated_electricity_mwh,
    result.energy.analysis_period_natural_gas_bcf,
    result.costs.total_lifecycle_cost_usd,
    result.presentValue.present_value_total_lifecycle_cost_usd,
    result.lcoe.lcoe_usd_per_mwh,
  ];
  for (const value of scalars) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  const buckets = Object.values(result.costs.buckets_undiscounted).reduce((a, b) => a + b, 0);
  expect(buckets).toBeCloseTo(result.costs.total_lifecycle_cost_usd, 2);
}

describe("full slider-range smoke sweep", () => {
  it("produces finite, reconciled outputs at each terrestrial control endpoint", () => {
    for (const control of ALL_TERRESTRIAL_SLIDERS) {
      for (const value of [control.min, control.max]) {
        expectFiniteAndReconciled({
          ...DEFAULT_TERRESTRIAL_INPUTS,
          [control.key]: value,
        });
      }
    }
  });

  it("exposes every architecture input exactly once across all slider groups", () => {
    const configured = ALL_TERRESTRIAL_SLIDERS.map((control) => control.key);
    expect(new Set(configured).size).toBe(configured.length);
    expect(new Set(configured)).toEqual(
      new Set<keyof TerrestrialArchitectureInputs>(Object.keys(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS) as (keyof TerrestrialArchitectureInputs)[]),
    );
  });
});
