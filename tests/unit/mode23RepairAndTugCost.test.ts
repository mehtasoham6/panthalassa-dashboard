import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { CONST } from "../../src/model/constants.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Node Repair Cost (mode23RepairCostUsd) and Tug Cost (tugCostUsdPerDay):
// two dollar-only assumptions promoted from fixed constants
// (disabling_mechanical_repair_cost_usd, tug_cost_usd_per_day) to
// user-configurable sliders. Neither may move failure probabilities,
// durations, energy, fleet sizing, or the descriptive resource metrics --
// only dollars.
describe("Node Repair Cost and Tug Cost sliders", () => {
  it("REGRESSION: defaults (50k repair / 10k-per-day tug) reproduce the exact pre-change baseline", () => {
    // These are exactly the old fixed CONST values -- verified by the fact
    // that the entire pre-existing test suite (286 tests) passes unchanged
    // against DEFAULT_INPUTS after this refactor.
    expect(DEFAULT_INPUTS.mode23RepairCostUsd).toBe(50_000);
    expect(DEFAULT_INPUTS.tugCostUsdPerDay).toBe(10_000);
    const r = runModel(DEFAULT_INPUTS);
    expect(r.N_fleet).toBe(5_258);
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(30.77, 1);
  });

  it("A: changing repair cost (20k / 500k) moves Mode 2/3 repair dollars, total lifecycle cost, and LCOE, but not failure rates or downtime", () => {
    const base = runModel(DEFAULT_INPUTS);
    const low = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 20_000 });
    const high = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000 });

    // Dollars move, and move linearly with the slider (pure multiplier).
    expect(low.costs.lineItems.unexpected_mechanical_repair_cost_usd).toBeLessThan(
      base.costs.lineItems.unexpected_mechanical_repair_cost_usd,
    );
    expect(high.costs.lineItems.unexpected_mechanical_repair_cost_usd).toBeGreaterThan(
      base.costs.lineItems.unexpected_mechanical_repair_cost_usd,
    );
    expect(high.costs.lineItems.unexpected_mechanical_repair_cost_usd).toBeCloseTo(
      base.costs.lineItems.unexpected_mechanical_repair_cost_usd * 10,
      2,
    );
    expect(low.costs.total_node_fleet_cost_usd).not.toBe(base.costs.total_node_fleet_cost_usd);
    expect(high.costs.total_node_fleet_cost_usd).not.toBe(base.costs.total_node_fleet_cost_usd);
    expect(low.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);
    expect(high.lcoe.lcoe_usd_per_mwh).not.toBe(base.lcoe.lcoe_usd_per_mwh);

    // Failure rates/counts and downtime (energy loss) are untouched.
    for (const r of [low, high]) {
      expect(r.modeLosses.mode_2_rate_annual).toBe(base.modeLosses.mode_2_rate_annual);
      expect(r.modeLosses.mode_3_rate_annual).toBe(base.modeLosses.mode_3_rate_annual);
      expect(r.modeLosses.mode_4_rate_annual).toBe(base.modeLosses.mode_4_rate_annual);
      expect(r.modeLosses.mode_5_rate_annual).toBe(base.modeLosses.mode_5_rate_annual);
      expect(r.modeLosses.total_modes_2_5_loss_kwh).toBe(base.modeLosses.total_modes_2_5_loss_kwh);
      expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(
        base.chip.expected_mode_1_surprise_service_event_count_per_position,
      );
      expect(r.N_fleet).toBe(base.N_fleet);
    }
  });

  it("B: changing tug cost scales tug-related dollars proportionally but never changes tug duration", () => {
    const base = runModel(DEFAULT_INPUTS);
    const low = runModel({ ...DEFAULT_INPUTS, tugCostUsdPerDay: 5_000 });
    const high = runModel({ ...DEFAULT_INPUTS, tugCostUsdPerDay: 50_000 });

    expect(low.costs.lineItems.unexpected_tug_cost_usd).toBeLessThan(base.costs.lineItems.unexpected_tug_cost_usd);
    expect(high.costs.lineItems.unexpected_tug_cost_usd).toBeGreaterThan(base.costs.lineItems.unexpected_tug_cost_usd);
    expect(high.costs.lineItems.unexpected_tug_cost_usd).toBeCloseTo(base.costs.lineItems.unexpected_tug_cost_usd * 5, 2);
    expect(low.costs.lineItems.normal_tug_cost_usd).toBeCloseTo(base.costs.lineItems.normal_tug_cost_usd * 0.5, 2);
    expect(high.costs.lineItems.normal_tug_cost_usd).toBeCloseTo(base.costs.lineItems.normal_tug_cost_usd * 5, 2);

    // Duration/route/schedule quantities are pure physical-geometry outputs, untouched by the $/day price.
    for (const r of [low, high]) {
      expect(r.derived.one_way_tug_days).toBe(base.derived.one_way_tug_days);
      expect(r.derived.one_way_journey_days).toBe(base.derived.one_way_journey_days);
      expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(
        base.chip.expected_mode_1_physical_tug_round_trips_per_position,
      );
      expect(r.modeLosses.total_modes_2_5_loss_kwh).toBe(base.modeLosses.total_modes_2_5_loss_kwh);
      expect(r.N_fleet).toBe(base.N_fleet);
    }
  });

  it("C: Mode 4/5 replacement cost is unchanged when the Mode 2/3 repair-cost slider moves", () => {
    const base = runModel(DEFAULT_INPUTS);
    const moved = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000 });
    expect(moved.costs.lineItems.fleet_complete_payload_replacement_cost_usd).toBe(
      base.costs.lineItems.fleet_complete_payload_replacement_cost_usd,
    );
    expect(moved.costs.lineItems.mode_4_5_non_compute_replacement_cost_usd).toBe(
      base.costs.lineItems.mode_4_5_non_compute_replacement_cost_usd,
    );
    expect(moved.costs.total_compute_replacement_cost_usd).toBe(base.costs.total_compute_replacement_cost_usd);
  });

  it("D: Mode 5 cleanup cost is unchanged by either slider", () => {
    const base = runModel(DEFAULT_INPUTS);
    const repairMoved = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000 });
    const tugMoved = runModel({ ...DEFAULT_INPUTS, tugCostUsdPerDay: 50_000 });
    expect(repairMoved.costs.lineItems.mode_5_catastrophic_cost_usd_total).toBe(
      base.costs.lineItems.mode_5_catastrophic_cost_usd_total,
    );
    expect(tugMoved.costs.lineItems.mode_5_catastrophic_cost_usd_total).toBe(
      base.costs.lineItems.mode_5_catastrophic_cost_usd_total,
    );
  });

  it("E: the five-year routine-maintenance cost formula (3% of non-compute capital) is unchanged by either slider", () => {
    const base = runModel(DEFAULT_INPUTS);
    const repairMoved = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000 });
    const tugMoved = runModel({ ...DEFAULT_INPUTS, tugCostUsdPerDay: 50_000 });
    expect(repairMoved.costs.lineItems.scheduled_node_maintenance_cost_usd).toBe(
      base.costs.lineItems.scheduled_node_maintenance_cost_usd,
    );
    expect(tugMoved.costs.lineItems.scheduled_node_maintenance_cost_usd).toBe(
      base.costs.lineItems.scheduled_node_maintenance_cost_usd,
    );
  });

  it("F: a Mode 3 event combines repair cost + retrieval (tug) cost -- both line items are simultaneously nonzero and independently additive, not substitutes", () => {
    const base = runModel(DEFAULT_INPUTS);
    expect(base.modeLosses.mode_3_rate_annual).toBeGreaterThan(0);
    expect(base.costs.lineItems.unexpected_mechanical_repair_cost_usd).toBeGreaterThan(0);
    expect(base.costs.lineItems.unexpected_tug_cost_usd).toBeGreaterThan(0);

    // Moving the repair-cost slider must not move the tug-cost line item, and vice versa.
    const repairMoved = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000 });
    expect(repairMoved.costs.lineItems.unexpected_tug_cost_usd).toBe(base.costs.lineItems.unexpected_tug_cost_usd);
    const tugMoved = runModel({ ...DEFAULT_INPUTS, tugCostUsdPerDay: 50_000 });
    expect(tugMoved.costs.lineItems.unexpected_mechanical_repair_cost_usd).toBe(
      base.costs.lineItems.unexpected_mechanical_repair_cost_usd,
    );
  });

  it("G: no old fixed $50,000 repair-cost or $10,000/day tug-rate constant remains in CONST", () => {
    const keys = Object.keys(CONST);
    expect(keys).not.toContain("disabling_mechanical_repair_cost_usd");
    expect(keys).not.toContain("tug_cost_usd_per_day");
  });

  it("neither slider affects the three descriptive resource metrics or LCOE's PTO-capped denominator", () => {
    const base = runModel(DEFAULT_INPUTS);
    const moved = runModel({ ...DEFAULT_INPUTS, mode23RepairCostUsd: 500_000, tugCostUsdPerDay: 50_000 });
    expect(moved.derived.resource_capacity_factor).toBe(base.derived.resource_capacity_factor);
    expect(moved.derived.rated_power_availability).toBe(base.derived.rated_power_availability);
    expect(moved.derived.keepalive_availability).toBe(base.derived.keepalive_availability);
    expect(moved.derived.lcoe_power_cap_kw).toBe(base.derived.lcoe_power_cap_kw);
    expect(moved.derived.power_cap_kw).toBe(base.derived.power_cap_kw);
  });
});
