import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  DEFAULT_TERRESTRIAL_INPUTS,
  runTerrestrialModel,
  type TerrestrialArchitectureInputs,
} from "../../src/terrestrial/model/index.js";
import {
  ALL_TERRESTRIAL_SLIDERS,
  getRelevantTerrestrialSliderGroups,
  TERRESTRIAL_POWER_SOURCE_OPTIONS,
} from "../../src/terrestrial/integration/index.js";

function expectFiniteAndReconciled(inputs: typeof DEFAULT_TERRESTRIAL_INPUTS): void {
  const result = runTerrestrialModel(inputs);
  const scalars = [
    result.capacity.power_plant_nameplate_capacity_mw,
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

  // renewable_capex_usd_per_kw/renewable_fixed_om_usd_per_kw_year/
  // renewable_capacity_factor/renewable_storage_capex_usd_per_kwh are
  // intentionally reused across every non-CCGT power-source group (the
  // model is a flat, always-present struct -- see types.ts), so
  // ALL_TERRESTRIAL_SLIDERS itself has expected duplicates. power_source is
  // the button selector, not a NumericControlConfig slider, so it's excluded.
  it("every architecture input except power_source is covered by at least one slider, across all power-source groups", () => {
    const configuredKeys = new Set(ALL_TERRESTRIAL_SLIDERS.map((control) => control.key));
    const expectedKeys = new Set(
      (Object.keys(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS) as (keyof TerrestrialArchitectureInputs)[]).filter(
        (key) => key !== "power_source",
      ),
    );
    expect(configuredKeys).toEqual(expectedKeys);
  });

  it("the sliders actually shown at once for any single power source have no duplicate keys", () => {
    for (const { key: powerSource } of TERRESTRIAL_POWER_SOURCE_OPTIONS) {
      const visibleKeys = getRelevantTerrestrialSliderGroups(powerSource).flatMap((g) => g.sliders.map((s) => s.key));
      expect(new Set(visibleKeys).size).toBe(visibleKeys.length);
    }
  });
});
