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
//     constant 100 kW/m: healthy compute * effective_sea_park_cf (raw CF
//     ~96.45% plus a small internal battery-smoothing bump, capped at 1.0,
//     never displayed itself). Modes 2/3's lost-output counterfactual uses
//     the same resource-adjusted rate. This is the dominant driver of the
//     numbers below moving versus the prior (pre-WAVERYS) revision.
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

  it("raw wave-resource capacity factor (the sole displayed metric) ~= 96.45%", () => {
    expect(r.derived.raw_wave_resource_cf).toBeCloseTo(0.9645, 3);
  });

  it("internal battery-adjusted sea-park factor ~= 96.66% at the default 0.5h battery (never displayed)", () => {
    expect(r.derived.effective_sea_park_cf).toBeCloseTo(0.9666, 3);
  });

  it("output declines from chip degradation AND the wave-resource correction, even with no service visit", () => {
    const avgKwPerNode = (r.expected_delivered_energy_per_position_mw_years / 5) * 1000;
    expect(avgKwPerNode).toBeLessThan(DEFAULT_INPUTS.payload_rating_kw);
    expect(avgKwPerNode).toBeCloseTo(188.214, 2);
  });

  it("chip-adjusted output ~= 8,263,780.769 kWh", () => {
    expect(r.chip.chip_adjusted_energy_kwh).toBeCloseTo(8_263_780.769, 0);
  });

  it("Modes 2-5 total loss ~= 20,025.413 kWh (lower than the pre-WAVERYS figure since the Mode 2/3 counterfactual is now also resource-adjusted)", () => {
    expect(r.modeLosses.total_modes_2_5_loss_kwh).toBeCloseTo(20_025.413, 0);
  });

  it("delivered output per slot ~= 0.941068 MW-years", () => {
    expect(r.expected_delivered_energy_per_position_mw_years).toBeCloseTo(0.941068, 4);
  });

  it("N_fleet == 5314", () => {
    expect(r.N_fleet).toBe(5314);
  });

  it("per-node physical cost table (unaffected by the resource correction)", () => {
    expect(r.costs.physical_node_cost_usd).toBeCloseTo(3_410_000, 0);
    expect(r.costs.non_compute_node_cost_usd).toBeCloseTo(410_000, 0);
  });

  it("planned physical fleet cost ~= $18.1207 billion", () => {
    expect(r.costs.total_planned_physical_node_cost_usd).toBeCloseTo(18_120_740_000, -3);
  });

  it("compute replacement ~= $62.772 million (Modes 4/5 complete-payload replacement only, remaining-life-depreciated -- no chip capacity has been replaced since no visit occurred)", () => {
    expect(r.costs.total_compute_replacement_cost_usd / 1e6).toBeCloseTo(62.772, 1);
  });

  it("non-compute maintenance/failure ~= $99.736 million", () => {
    expect(r.costs.total_non_compute_maintenance_failure_cost_usd / 1e6).toBeCloseTo(99.736, 1);
  });

  it("workload data-transfer cost ~= $591.399 million undiscounted", () => {
    expect(r.costs.total_workload_data_transfer_cost_usd / 1e6).toBeCloseTo(591.399, 0);
  });

  it("dashboard cost buckets (billions), including the workload data-transfer bucket", () => {
    expect(r.costs.buckets.compute_and_replacement_usd / 1e9).toBeCloseTo(16.005, 2);
    expect(r.costs.buckets.initial_non_compute_physical_usd / 1e9).toBeCloseTo(2.179, 2);
    expect(r.costs.buckets.non_compute_maintenance_failure_usd / 1e9).toBeCloseTo(0.0997, 3);
    expect(r.costs.buckets.workload_data_transfer_usd / 1e9).toBeCloseTo(0.591, 2);
  });

  it("total undiscounted cost rounds to $18.87 billion", () => {
    expect(r.costs.total_node_fleet_cost_usd / 1e9).toBeCloseTo(18.87, 1);
  });

  it("annual cost schedule", () => {
    const target = [18_129_596_666.67, 153_286_375.25, 150_938_430.78, 148_932_160.39, 146_937_739.02, 144_955_048.78];
    r.presentValue.yearly_cost_usd.forEach((v, i) => {
      expect(v).toBeCloseTo(target[i]!, -3);
    });
  });

  it("present-value total cost ~= $18.758 billion", () => {
    expect(r.presentValue.present_value_total_node_fleet_cost_usd / 1e9).toBeCloseTo(18.758, 2);
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
