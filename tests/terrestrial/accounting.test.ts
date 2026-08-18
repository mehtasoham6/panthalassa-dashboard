import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRESTRIAL_INPUTS,
  plannedCapitalSchedule,
  runTerrestrialModel,
} from "../../src/terrestrial/model/index.js";

describe("lifecycle accounting convention", () => {
  it("charges the initial asset in full even when the analysis period is short", () => {
    const schedule = plannedCapitalSchedule(1_000, 30, 5);
    expect(schedule[0]).toBe(1_000);
    expect(schedule.slice(1).every((value) => value === 0)).toBe(true);
  });

  it("prorates only later planned generations and never creates a residual credit", () => {
    const schedule = plannedCapitalSchedule(1_000, 30, 35);
    expect(schedule[0]).toBe(1_000);
    expect(schedule[30]).toBeCloseTo(1_000 * (5 / 30), 12);
    expect(schedule.every((value) => value >= 0)).toBe(true);
  });

  it("equals undiscounted cost when the real discount rate is zero", () => {
    const result = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, real_discount_rate: 0 });
    expect(result.presentValue.present_value_total_lifecycle_cost_usd).toBeCloseTo(
      result.costs.total_lifecycle_cost_usd,
      3,
    );
  });

  it("discounting cannot change the undiscounted total", () => {
    const low = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, real_discount_rate: 0.02 });
    const high = runTerrestrialModel({ ...DEFAULT_TERRESTRIAL_INPUTS, real_discount_rate: 0.10 });
    expect(high.costs.total_lifecycle_cost_usd).toBe(low.costs.total_lifecycle_cost_usd);
    expect(high.presentValue.present_value_total_lifecycle_cost_usd)
      .toBeLessThan(low.presentValue.present_value_total_lifecycle_cost_usd);
  });
});
