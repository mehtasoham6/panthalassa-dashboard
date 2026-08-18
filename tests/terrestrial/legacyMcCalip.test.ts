import { describe, expect, it } from "vitest";
import {
  calculateLegacyMcCalipTerrestrial,
  DEFAULT_LEGACY_MCCALIP_INPUTS,
} from "../../src/terrestrial/model/index.js";
import lockedLegacy from "../../reference-outputs/mccalip-legacy-default.json";

describe("McCalip terrestrial reproduction", () => {
  const result = calculateLegacyMcCalipTerrestrial(DEFAULT_LEGACY_MCCALIP_INPUTS);

  it("reproduces the public default energy and generation totals", () => {
    expect(result.energyMWh).toBe(37_230_000);
    expect(result.generationMWh).toBe(44_676_000);
    expect(result.totalGenerationMW).toBe(1_200);
  });

  it("reproduces every material public default cost output", () => {
    expect(result.powerGenCost).toBe(2_160_000_000);
    expect(result.infraCapex).toBe(14_660_000_000);
    expect(result.fuelCostPerMWh).toBeCloseTo(26.66, 12);
    expect(result.fuelCostTotal).toBeCloseTo(1_191_062_160, 4);
    expect(result.totalCost).toBeCloseTo(15_851_062_160, 4);
    expect(result.costPerW).toBeCloseTo(15.85106216, 10);
  });

  it("reproduces McCalip's reported LCOE and gas consumption", () => {
    expect(result.lcoe).toBeCloseTo(425.76046629062586, 10);
    expect(result.gasConsumptionBCF).toBeCloseTo(276.9912, 8);
  });

  it("keeps the portable legacy JSON synchronized with the executable transcription", () => {
    for (const [key, expected] of Object.entries(lockedLegacy.outputs)) {
      expect(result[key as keyof typeof result]).toBe(expected);
    }
  });
});
