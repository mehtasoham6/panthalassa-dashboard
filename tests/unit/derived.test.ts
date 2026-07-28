import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS } from "../../src/model/types.js";
import { computeDerived } from "../../src/model/derived.js";

describe("derived quantities at defaults (Section 2, 9.2)", () => {
  const d = computeDerived(DEFAULT_INPUTS);

  it("capture width ratio = 0.316", () => {
    expect(d.capture_width_ratio).toBeCloseTo(0.316, 10);
  });

  it("full-output flux ~= 37.23 kW/m", () => {
    expect(d.full_output_flux_kw_per_m).toBeCloseTo(37.23, 2);
  });

  it("one-way journey = 30.375 days (0.167 tug + 30.208 self-propulsion)", () => {
    expect(d.one_way_tug_days).toBeCloseTo(0.167, 3);
    expect(d.one_way_self_propulsion_days).toBeCloseTo(30.208, 3);
    expect(d.one_way_journey_days).toBeCloseTo(30.375, 3);
  });

  it("guaranteed/best-effort split at default 10% hot spares: 180/20 kW", () => {
    expect(d.guaranteed_capacity_kw).toBeCloseTo(180, 6);
    expect(d.best_effort_capacity_kw).toBeCloseTo(20, 6);
  });

  it("power cap = 200 kW, pto = 300 kW", () => {
    expect(d.power_cap_kw).toBe(200);
    expect(d.pto_rating_kw).toBe(300);
  });
});
