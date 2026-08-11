import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { computeDerived } from "../../src/model/derived.js";
import { averageRemainingLifeFraction } from "../../src/model/remainingLife.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Direct tests for the unified compute-health / service-schedule engine
// (continuous kW degradation, hot-spare-exhaustion trigger, fixed 5-year
// maintenance, merge behavior, and Modes 4/5 total-loss replacement).

describe("hot-spare / guaranteed capacity split", () => {
  it("200 kW payload, 10% hot spares -> 180 kW guaranteed / 20 kW best-effort", () => {
    const d = computeDerived({ ...DEFAULT_INPUTS, payload_rating_kw: 200, hotSpareShare: 0.10 });
    expect(d.guaranteed_capacity_kw).toBeCloseTo(180, 6);
    expect(d.best_effort_capacity_kw).toBeCloseTo(20, 6);
    expect(d.guaranteed_capacity_kw + d.best_effort_capacity_kw).toBeCloseTo(200, 6);
  });
});

describe("surprise-service trigger age", () => {
  it("10% hot spares, 1% hazard -> trigger age ~= 10.54 years", () => {
    const h = 0.10;
    const lambda = 0.01;
    const triggerAgeYears = -Math.log(1 - h) / lambda;
    expect(triggerAgeYears).toBeCloseTo(10.536, 2);
  });

  it("10% hot spares, 10% hazard -> trigger age ~= 1.05 years", () => {
    const h = 0.10;
    const lambda = 0.10;
    const triggerAgeYears = -Math.log(1 - h) / lambda;
    expect(triggerAgeYears).toBeCloseTo(1.054, 2);
  });
});

describe("output declines before any trip is triggered", () => {
  it("at defaults (trigger age ~10.54yr >> 5yr horizon), no service visit ever occurs, yet delivered output per node is below installed payload", () => {
    const r = runModel(DEFAULT_INPUTS);
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(0);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBe(0);

    const avgKwPerNode = (r.expected_delivered_energy_per_position_mw_years / DEFAULT_INPUTS.analysis_period_years) * 1000;
    expect(avgKwPerNode).toBeLessThan(DEFAULT_INPUTS.payload_rating_kw);
  });

  it("higher chip hazard (still below the surprise threshold) reduces delivered output further and raises N_fleet, with no visits either", () => {
    const low = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.005 });
    const high = runModel({ ...DEFAULT_INPUTS, chip_failure_rate_annual: 0.02 });
    // trigger age at 2% hazard = -ln(0.9)/0.02 ~= 5.27yr, still just above the 5yr horizon.
    expect(high.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(0);
    expect(high.expected_delivered_energy_per_position_mw_years).toBeLessThan(low.expected_delivered_energy_per_position_mw_years);
    expect(high.N_fleet).toBeGreaterThanOrEqual(low.N_fleet);
  });
});

describe("a surprise service restores health, and near-coincident fixed maintenance dates now consolidate into the same trip (6-month window)", () => {
  it("10% hot spares, 10% hazard, 10-year horizon: 8 surprise visits occur, and BOTH the year-5 and year-10 fixed-maintenance dates happen to fall within 6 months of a nearby surprise visit, so both consolidate (8 distinct physical trips total, not 10)", () => {
    const inputs = { ...DEFAULT_INPUTS, hotSpareShare: 0.10, chip_failure_rate_annual: 0.10, analysis_period_years: 10 };
    const r = runModel(inputs);
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(8);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(2);
    expect(r.chip.yearly_scheduled_full_maintenance_events[4]).toBe(1); // year 5, consolidated with a surprise visit
    expect(r.chip.yearly_scheduled_full_maintenance_events[9]).toBe(1); // year 10, consolidated with a surprise visit

    // Both fixed-maintenance dates were absorbed into a nearby surprise trip (the 6-month
    // consolidation window), so total physical trips equals the surprise-visit count, not
    // surprise + maintenance (which would double-count the two combined visits).
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(8);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(
      r.chip.expected_mode_1_surprise_service_event_count_per_position,
    );
  });
});

describe("fixed maintenance replaces only capacity failed since the previous restoration", () => {
  it("20% hot spares, 1% hazard (trigger ~22.3yr, never fires), 10-year horizon: exactly one fixed visit at year 5, replacing P*(1-e^(-lambda*age)) at that age", () => {
    const inputs = { ...DEFAULT_INPUTS, hotSpareShare: 0.20, chip_failure_rate_annual: 0.01, analysis_period_years: 10 };
    const r = runModel(inputs);
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(0);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);

    const maintenanceDockYears = 7 / 365;
    const ageAtService = 5 - maintenanceDockYears; // arrival back at dock, just before the 7-day maintenance dock elapses
    const expectedFailedKw = inputs.payload_rating_kw * (1 - Math.exp(-inputs.chip_failure_rate_annual * ageAtService));
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(expectedFailedKw, 3);
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(9.7176, 3);

    // The second (year-10) visit is boundary-excluded (completes exactly at the horizon), so
    // nothing further is credited or replaced after year 5.
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBeCloseTo(r.chip.yearly_failed_capacity_kw_replaced[4]!, 6);
  });
});

describe("merged surprise and fixed visits avoid duplicate trips and costs", () => {
  it("a trigger age landing just before year 5 merges into one combined visit, not two", () => {
    const lambda = -Math.log(0.9) / 4.95; // trigger age ~4.95yr, close enough to year 5 to overlap its return+dock window
    const inputs = { ...DEFAULT_INPUTS, chip_failure_rate_annual: lambda, analysis_period_years: 10 };
    const r = runModel(inputs);

    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(1);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(1);
    // A merged visit is ONE physical trip, not two -- this is the key deduplication check.
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(1);

    // Both event counts and the tug trip land in the same year bucket (the same visit).
    const surpriseYear = r.chip.yearly_surprise_service_events.findIndex((v) => v > 0);
    const maintenanceYear = r.chip.yearly_scheduled_full_maintenance_events.findIndex((v) => v > 0);
    const tugYear = r.chip.yearly_mode_1_tug_round_trips.findIndex((v) => v > 0);
    expect(surpriseYear).toBe(maintenanceYear);
    expect(surpriseYear).toBe(tugYear);
  });
});

describe("Modes 4 and 5 still require full payload replacement", () => {
  it("fleet_complete_payload_replacement_cost_usd and mode_4_5_non_compute_replacement_cost_usd follow the expected total-loss-event formula, scaled by the average remaining-economic-life fraction (Change 4), independent of the compute-health engine", () => {
    const inputs = { ...DEFAULT_INPUTS, node_failure_rate_annual: 0.10 };
    const r = runModel(inputs);
    const computeHwCost = inputs.payload_rating_kw * inputs.compute_hardware_cost_usd_per_kw;
    const expectedEvents =
      r.N_fleet * inputs.analysis_period_years * (r.modeLosses.mode_4_rate_annual + r.modeLosses.mode_5_rate_annual);
    const avgRemainingLifeFraction = averageRemainingLifeFraction(0, inputs.analysis_period_years, inputs.node_lifetime_years);

    expect(r.costs.lineItems.fleet_complete_payload_replacement_cost_usd).toBeCloseTo(
      expectedEvents * computeHwCost * avgRemainingLifeFraction,
      2,
    );
    expect(r.costs.lineItems.mode_4_5_non_compute_replacement_cost_usd).toBeCloseTo(
      expectedEvents * r.costs.non_compute_node_cost_usd * avgRemainingLifeFraction,
      2,
    );
    expect(r.costs.lineItems.fleet_complete_payload_replacement_cost_usd).toBeGreaterThan(0);
  });

  it("total_compute_replacement_cost_usd is unaffected by Modes 4/5 replacement being purely capacity-driven vs. total-node-driven", () => {
    // At defaults (no chip-triggered service occurs), total compute replacement cost comes
    // entirely from Modes 4/5 complete-payload replacement, not from any chip capacity credit.
    const r = runModel(DEFAULT_INPUTS);
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBe(0);
    expect(r.costs.total_compute_replacement_cost_usd).toBeCloseTo(r.costs.lineItems.fleet_complete_payload_replacement_cost_usd, 2);
  });
});
