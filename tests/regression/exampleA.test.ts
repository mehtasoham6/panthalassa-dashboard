import { describe, expect, it } from "vitest";
import { runModel } from "../../src/model/index.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

// Worked Example A: all slider defaults, under the revised model:
//  1. Self-propelled transit ramps continuously to/from the sea-park flux
//     (40 -> 100 kW/m, was 40 -> 75) -- no effect on Example A's delivered
//     energy, since the equipment cap already binds the whole self-propelled
//     leg at these defaults; it only raises (unreported) surplus there.
//  2. The battery starts every port departure fully charged (100 kWh at
//     defaults) rather than empty, reducing the outbound weak-wave shortfall
//     credited against Modes 2-5 events.
//  3. Surprise/fixed-maintenance consolidation uses a 6-month window
//     (irrelevant here -- no service visits occur at all within 5 years).
//  4. Modes 4/5 total-loss replacement cost is scaled by the average
//     remaining straight-line economic life over the horizon.
//  5. Sea-park output is now scheduled against the Copernicus WAVERYS
//     (1980-2025) historical wave-resource capacity factor at the
//     representative sea-park point, instead of an always-available
//     constant 100 kW/m: healthy compute * effective_sea_park_cf (~96.66%
//     at these defaults -- an energy-average wave-resource factor plus a
//     small internal battery-smoothing bump, capped at 1.0, never displayed
//     itself -- the dashboard's separate "Resource capacity factor" tile is
//     a distinct, display-only metric that does not feed this calculation;
//     see waverys.test.ts). Modes 2/3's lost-output counterfactual uses the
//     same resource-adjusted rate.
//  6. Total lifecycle cost allocates capital cost by planned generation (see
//     generationCapital.ts): the initial fleet (generation 0) is always
//     charged in full, and later planned replacement generations are
//     charged only their share of a full generation's capital cost that
//     falls within the analysis horizon. At these defaults (5-year
//     analysis, 20-year node life) there is only one planned generation, so
//     this allocation is a no-op -- the totals below are the full,
//     unprorated fleet cost, identical to charging every generation in
//     full.
//
// At defaults, the trigger age (~10.54yr) is far beyond the 5-year horizon,
// and the one fixed-maintenance boundary (year 5) coincides exactly with the
// horizon and is excluded -- so NO service visit occurs at all. Output still
// declines from chip degradation and the wave-resource correction despite
// that (service-event timing itself is unaffected by the resource
// correction -- only energy totals are).
describe("Worked Example A - all defaults (revised route/battery/consolidation/depreciation/WAVERYS resource)", () => {
  const r = runModel(DEFAULT_INPUTS);

  it("no service visits occur within the 5-year horizon", () => {
    expect(r.chip.expected_mode_1_surprise_service_event_count_per_position).toBe(0);
    expect(r.chip.scheduled_node_maintenance_event_count_per_position).toBe(0);
    expect(r.chip.expected_mode_1_physical_tug_round_trips_per_position).toBe(0);
    expect(r.chip.expected_failed_capacity_kw_replaced_per_position).toBe(0);
  });

  it("internal battery-adjusted sea-park factor ~= 96.66% at the default 0.5h battery (never displayed)", () => {
    expect(r.derived.effective_sea_park_cf).toBeCloseTo(0.9666, 3);
  });

  it("output declines from chip degradation AND the wave-resource correction, even with no service visit", () => {
    const avgKwPerNode = (r.expected_delivered_energy_per_position_mw_years / 5) * 1000;
    expect(avgKwPerNode).toBeLessThan(DEFAULT_INPUTS.payload_rating_kw);
    expect(avgKwPerNode).toBeCloseTo(188.327, 2);
  });

  it("chip-adjusted output ~= 8,261,444.000 kWh", () => {
    expect(r.chip.chip_adjusted_energy_kwh).toBeCloseTo(8_261_444.000, 0);
  });

  it("Modes 2-5 total loss ~= 12,729.323 kWh (lower than the pre-WAVERYS figure since the Mode 2/3 counterfactual is now also resource-adjusted)", () => {
    expect(r.modeLosses.total_modes_2_5_loss_kwh).toBeCloseTo(12_729.323, 0);
  });

  it("delivered output per slot ~= 0.941634 MW-years", () => {
    expect(r.expected_delivered_energy_per_position_mw_years).toBeCloseTo(0.941634, 4);
  });

  it("N_fleet == 5310", () => {
    expect(r.N_fleet).toBe(5310);
  });

  it("per-node physical cost table (hull cost now cubically scaled: ~261t at 20m x $2,000/t)", () => {
    expect(r.costs.physical_node_cost_usd).toBeCloseTo(5_632_068, 0);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(632_068, 0);
  });

  it("planned physical fleet cost ~= $29.90628 billion", () => {
    expect(r.costs.total_planned_physical_node_cost_usd).toBeCloseTo(29_906_280_488, -3);
  });

  it("compute replacement ~= $104.541 million (Modes 4/5 complete-payload replacement only, remaining-life-depreciated -- no chip capacity has been replaced since no visit occurred)", () => {
    expect(r.costs.total_compute_replacement_cost_usd / 1e6).toBeCloseTo(104.541, 1);
  });

  it("non-compute maintenance/failure ~= $92.410 million", () => {
    expect(r.costs.total_non_compute_maintenance_failure_cost_usd / 1e6).toBeCloseTo(92.410, 1);
  });

  it("workload data-transfer cost ~= $591.309 million undiscounted", () => {
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.309, 0);
  });

  it("dashboard cost buckets (billions), initial generation charged in full (only one planned generation at these defaults)", () => {
    expect(r.costs.buckets.compute_and_replacement_usd / 1e9).toBeCloseTo(26.655, 2);
    expect(r.costs.buckets.initial_non_compute_physical_usd / 1e9).toBeCloseTo(3.356, 2);
    expect(r.costs.buckets.non_compute_maintenance_failure_usd / 1e9).toBeCloseTo(0.0924, 3);
    expect(r.costs.buckets.workload_data_transfer_usd / 1e9).toBeCloseTo(0.591, 2);
  });

  it("no residual/terminal-value metric exists anywhere in the costs result", () => {
    expect(Object.keys(r.costs)).not.toContain("terminal_residual_value_usd");
    expect(Object.keys(r.costs.lineItems)).not.toContain("terminal_residual_value_usd");
  });

  it("undiscounted lifecycle cost rounds to $30.69 billion (initial fleet charged in full, pre-proration-era value)", () => {
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(30.69, 2);
  });

  it("annual cost schedule (no terminal credit at year 5/Tend)", () => {
    const target = [29_915_130_488.21, 161_082_985.85, 158_373_356.91, 155_837_633.57, 153_313_750.34, 150_801_589.40];
    r.presentValue.yearly_cost_usd.forEach((v, i) => {
      expect(v).toBeCloseTo(target[i]!, -3);
    });
  });

  it("present-value lifecycle cost ~= $30.539 billion (8% real discount rate)", () => {
    expect(r.presentValue.present_value_total_node_fleet_cost_usd / 1e9).toBeCloseTo(30.539, 2);
  });

  it("power-system LCOE (compute-agnostic, over the 20-year node life, not the 5-year analysis period) lands in a sane $/MWh range", () => {
    expect(r.lcoe.lcoe_horizon_years).toBe(20);
    expect(r.lcoe.lcoe_usd_per_mwh).toBeGreaterThan(10);
    expect(r.lcoe.lcoe_usd_per_mwh).toBeLessThan(60);
  });

  it("cost buckets sum to the total (unrounded, exact identity)", () => {
    const sum =
      r.costs.buckets.compute_and_replacement_usd +
      r.costs.buckets.initial_non_compute_physical_usd +
      r.costs.buckets.non_compute_maintenance_failure_usd +
      r.costs.buckets.workload_data_transfer_usd;
    expect(sum).toBeCloseTo(r.costs.total_node_fleet_cost_usd, 4);
  });

  it("yearly cost buckets sum to the undiscounted total (annual allocation invariant)", () => {
    const sum = r.presentValue.yearly_cost_usd.reduce((a, b) => a + b, 0);
    const tol = Math.max(0.01, 1e-10 * Math.abs(r.costs.total_node_fleet_cost_usd));
    expect(Math.abs(sum - r.costs.total_node_fleet_cost_usd)).toBeLessThan(tol);
  });

  it("fleet-size minimality", () => {
    const slot = r.expected_delivered_energy_per_position_mw_years;
    expect((r.N_fleet - 1) * slot).toBeLessThan(r.target_energy_mw_years);
    expect(r.target_energy_mw_years).toBeLessThanOrEqual(r.N_fleet * slot);
  });
});
