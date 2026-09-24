import { describe, expect, it } from "vitest";
import { computeDerived } from "../../src/model/derived.js";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

describe("displayed resource metrics over the modeled journey", () => {
  it("includes only the outbound trip at the default five-year boundary", () => {
    const sea = computeDerived(DEFAULT_INPUTS);
    const result = runModel(DEFAULT_INPUTS);
    const travelShare = sea.one_way_journey_days / (365 * DEFAULT_INPUTS.analysis_period_years);
    // The default battery fully covers the initial travel deficit. No return
    // or dockside service completes before the five-year endpoint.
    expect(result.derived.resource_capacity_factor)
      .toBeCloseTo(sea.resource_capacity_factor * (1 - travelShare) + travelShare, 10);
    expect(result.derived.rated_power_availability)
      .toBeCloseTo(sea.rated_power_availability * (1 - travelShare) + travelShare, 10);
    expect(result.derived.keepalive_availability).toBe(1);
    expect(result.chip.journey_resource_metrics.keepalive_availability).toBe(1);
  });

  it("reveals the departure gap when the battery is zero", () => {
    const withoutBattery = runModel({ ...DEFAULT_INPUTS, battery_duration_hours: 0 });
    const withBattery = runModel(DEFAULT_INPUTS);
    const seaWithoutBattery = computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: 0 });
    expect(seaWithoutBattery.keepalive_availability).toBe(1);
    expect(withoutBattery.derived.keepalive_availability).toBeLessThan(1);
    expect(withoutBattery.derived.keepalive_availability).toBeGreaterThan(0.9999);
    for (const key of ["resource_capacity_factor", "rated_power_availability", "keepalive_availability"] as const) {
      expect(withoutBattery.derived[key]).toBeLessThan(withBattery.derived[key]);
    }
  });

  it("counts completed dockside maintenance as zero availability", () => {
    const inputs = { ...DEFAULT_INPUTS, analysis_period_years: 10 };
    const sea = computeDerived(inputs);
    const result = runModel(inputs);
    expect(result.derived.keepalive_availability).toBeLessThan(sea.keepalive_availability);
    expect(result.derived.keepalive_availability).toBeLessThan(1);
    expect(result.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
  });
});
