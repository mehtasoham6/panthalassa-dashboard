import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { computeDerived } from "../../src/model/derived.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Six-month maintenance-consolidation window (Change 3): a standalone
// surprise payload-service visit that would complete within 6 months
// before the next fixed 5-year maintenance date is consolidated into one
// combined 7-day visit instead of two separate trips.
//
// Each scenario below picks a chip-degradation hazard so the trigger age
// (-ln(1-h)/lambda, h=10% hot spares) makes the standalone surprise visit's
// completion land at an exact number of months before the year-5 mark.
function lambdaForMonthsBeforeYear5(monthsBefore: number, hotSpareShare: number): number {
  const derived = computeDerived(DEFAULT_INPUTS);
  const returnYears = derived.one_way_journey_days / 365;
  const payloadDockYears = 1 / 365;
  const targetOrdinaryCompletion = 5 - monthsBefore / 12;
  const triggerAgeYears = targetOrdinaryCompletion - returnYears - payloadDockYears;
  return -Math.log(1 - hotSpareShare) / triggerAgeYears;
}

describe("maintenance consolidation window", () => {
  it("exactly 6 months before -> combine (boundary inclusive)", () => {
    const lambda = lambdaForMonthsBeforeYear5(6.0, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda });
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(1);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(1);
  });

  it("5.9 months before -> combine", () => {
    const lambda = lambdaForMonthsBeforeYear5(5.9, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda });
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(1);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(1);
  });

  it("6.1 months before -> do not combine (two separate trips)", () => {
    const lambda = lambdaForMonthsBeforeYear5(6.1, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda });
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(1);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    // A standalone surprise trip still occurs (1 tug trip) -- the fixed
    // maintenance date itself falls after this 5-year horizon, so it never
    // materializes as its own event within the analysis period.
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(1);
  });

  it("combined service charges maintenance labor exactly once, matching N_fleet x 3% x non-compute cost (not a second, duplicate charge)", () => {
    const lambda = lambdaForMonthsBeforeYear5(6.0, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda });
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    const expectedMaintenanceLabor = r.N_fleet * 1 * 0.03 * r.costs.non_compute_node_cost_usd;
    expect(r.costs.lineItems.scheduled_node_maintenance_cost_usd).toBeCloseTo(expectedMaintenanceLabor, 2);

    const standaloneLambda = lambdaForMonthsBeforeYear5(6.1, 0.1);
    const standalone = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: standaloneLambda });
    expect(standalone.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    expect(standalone.costs.lineItems.scheduled_node_maintenance_cost_usd).toBe(0);
  });

  it("next maintenance occurs five years after the actual combined-service date, not five years after the superseded calendar date", () => {
    // A repeating merge pattern (self-similar cycle length) makes the drift
    // away from clean multiples of 5 observable and cumulative: with the
    // bug fixed, three merges land at years 5, 10, and ~14.5 (comfortably
    // inside a 15-year horizon). Under the pre-fix bug -- which always reset
    // the clock to (superseded date + 5), i.e. exactly 5, 10, 15 -- the third
    // merge's date would land exactly ON the horizon and be boundary
    // -excluded, leaving only 2 maintenance events instead of 3.
    const lambda = lambdaForMonthsBeforeYear5(6.0, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda, analysis_period_years: 15 });
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(3);
    expect(r.chip.yearly_scheduled_full_maintenance_events[4]).toBe(1); // year 5
    expect(r.chip.yearly_scheduled_full_maintenance_events[9]).toBe(1); // year 10
    expect(r.chip.yearly_scheduled_full_maintenance_events[13]).toBe(1); // year 14 (drifted earlier than 15)
    expect(r.chip.yearly_scheduled_full_maintenance_events[14]).toBe(0); // not year 15
  });

  it("a standalone surprise visit well outside the window leaves the year-5 maintenance date unchanged, over a longer horizon", () => {
    const lambda = lambdaForMonthsBeforeYear5(6.1, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda, analysis_period_years: 10 });
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(2);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    // 2 standalone surprise trips + 1 fully separate fixed-maintenance trip = 3 (no merge/dedup).
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(3);
    expect(r.chip.yearly_scheduled_full_maintenance_events[4]).toBe(1); // year 5, unmoved
  });

  it("no duplicate service is counted at the analysis horizon (boundary exclusion still holds)", () => {
    const lambda = lambdaForMonthsBeforeYear5(6.1, 0.1);
    const r = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda, analysis_period_years: 10 });
    // The second surprise visit lands in year 10's bucket; the year-10 fixed
    // maintenance itself would complete exactly at Tend and is excluded.
    expect(r.chip.yearly_scheduled_full_maintenance_events[9]).toBe(0);
  });
});
