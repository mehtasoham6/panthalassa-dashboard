import { describe, expect, it } from "vitest";
import { DEFAULT_TERRESTRIAL_INPUTS, runTerrestrialModel } from "../../src/terrestrial/model/index.js";

describe("input validation", () => {
  it("rejects impossible PUE and availability", () => {
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, pue: 0.99 })).toThrow(/pue/);
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, power_system_availability: 0 })).toThrow(/availability/);
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, power_system_availability: 1.01 })).toThrow(/availability/);
  });

  it("rejects non-integer time horizons", () => {
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, analysis_period_years: 5.5 })).toThrow(/integer/);
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, ccgt_economic_life_years: 30.5 })).toThrow(/integer/);
  });

  it("rejects negative physical costs and non-finite values", () => {
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, delivered_gas_price_usd_per_mmbtu: -1 })).toThrow(/gas/);
    expect(() => runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, target_capacity_gw: Number.NaN })).toThrow(/finite/);
  });
});
