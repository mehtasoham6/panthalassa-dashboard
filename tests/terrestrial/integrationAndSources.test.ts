import { describe, expect, it } from "vitest";
import {
  ASSUMPTION_PROVENANCE,
  DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  MODEL_SOURCES,
} from "../../src/terrestrial/model/index.js";
import {
  buildTerrestrialInputs,
  comparableOutputsFromPanthalassa,
  sharedInputsFromPanthalassa,
} from "../../src/terrestrial/integration/index.js";

const panInputs = {
  target_capacity_gw: 2,
  analysis_period_years: 10,
  real_discount_rate: 0.075,
  chip_failure_rate_annual: 0.02,
  compute_hardware_cost_usd_per_kw: 20_000,
  workloadBandwidthIntensityMbpsPerKw: 0.05,
};

describe("Panthalassa adapter", () => {
  it("copies exactly and only the shared comparison inputs (real_discount_rate and chip_failure_rate_annual are architecture-specific, not copied)", () => {
    const sharedOnly = {
      target_capacity_gw: panInputs.target_capacity_gw,
      analysis_period_years: panInputs.analysis_period_years,
      compute_hardware_cost_usd_per_kw: panInputs.compute_hardware_cost_usd_per_kw,
      workloadBandwidthIntensityMbpsPerKw: panInputs.workloadBandwidthIntensityMbpsPerKw,
    };
    expect(sharedInputsFromPanthalassa(panInputs)).toEqual(sharedOnly);
    expect(buildTerrestrialInputs(panInputs)).toEqual({
      ...sharedOnly,
      ...DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
    });
  });

  it("maps a Panthalassa-shaped result into the common output contract without importing frozen code", () => {
    const comparable = comparableOutputsFromPanthalassa({
      inputs: { ...panInputs, payload_rating_kw: 200 },
      N_fleet: 12_345,
      costs: {
        total_node_fleet_cost_usd: 50,
        total_workload_data_transferred_gb: 60,
      },
      presentValue: {
        yearly_delivered_energy_mwh: [0, 1, 2],
        present_value_total_node_fleet_cost_usd: 40,
        present_value_workload_data_transfer_cost_usd: 5,
        lifecycle_cost_per_target_watt_usd: 25,
      },
      lcoe: { lcoe_usd_per_mwh: 30 },
    });
    expect(comparable.architecture).toBe("panthalassa");
    expect(comparable.analysis_period_delivered_compute_mwh).toBe(3);
    expect(comparable.installed_architecture_capacity_gw).toBeCloseTo(2.469, 12);
    expect(comparable.initial_compute_hardware_capex_usd).toBe(49_380_000_000);
  });
});

describe("source audit trail", () => {
  it("gives every architecture input one provenance record", () => {
    const documented = new Set(ASSUMPTION_PROVENANCE.map((entry) => entry.input));
    expect(documented).toEqual(new Set(Object.keys(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS)));
  });

  it("contains no dangling source references", () => {
    const sourceIds = new Set(MODEL_SOURCES.map((source) => source.id));
    for (const assumption of ASSUMPTION_PROVENANCE) {
      expect(assumption.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of assumption.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
    }
  });

  it("keeps provenance default values synchronized with executable defaults", () => {
    for (const assumption of ASSUMPTION_PROVENANCE) {
      expect(assumption.defaultValue).toBe(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS[assumption.input]);
    }
  });

  it("uses stable HTTPS source URLs", () => {
    for (const source of MODEL_SOURCES) expect(source.url.startsWith("https://")).toBe(true);
  });
});
