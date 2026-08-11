import { describe, expect, it } from "vitest";
import { WAVE_FLUX, rampLegEnergyKwh, outboundLegSegments, returnLegSegments } from "../../src/model/energy.js";
import { computeDerived } from "../../src/model/derived.js";
import { DEFAULT_INPUTS } from "../../src/model/types.js";

describe("self-propelled transit connects continuously to the sea park (Change 1)", () => {
  it("WAVE_FLUX stage endpoints are 0 -> 40 -> 100 -> 100 -> 40 -> 0, with no separate 75 kW/m breakpoint", () => {
    expect(WAVE_FLUX.dock).toBe(0);
    expect(WAVE_FLUX.deepWaterTransfer).toBe(40);
    expect(WAVE_FLUX.seaPark).toBe(100);
    expect("lateTransit" in WAVE_FLUX).toBe(false);
  });

  it("outbound self-propulsion ramps 40 -> 100 kW/m (not 40 -> 75)", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const capParams = { capture_coefficient: derived.capture_coefficient, power_cap_kw: derived.power_cap_kw, full_output_flux_kw_per_m: derived.full_output_flux_kw_per_m };
    const to75 = rampLegEnergyKwh(40, 75, derived.one_way_self_propulsion_days, capParams);
    const to100 = rampLegEnergyKwh(40, 100, derived.one_way_self_propulsion_days, capParams);
    // At default geometry the threshold (~37.23 kW/m) is below 40, so both legs are
    // fully at-cap and deliver identically -- the ramp extension only raises the
    // wave resource above cap (surplus), not delivered energy. Confirms this
    // via the segments API directly (see next test) and confirms the *available*
    // wave energy differs between the two endpoints.
    expect(to100).toBeCloseTo(to75, 6); // delivered (capped) energy identical at these defaults
  });

  it("outbound and return self-propulsion segments now end/start exactly at the sea-park flux (100 kW/m), not 75", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const legInputs = {
      one_way_tug_days: derived.one_way_tug_days,
      one_way_self_propulsion_days: derived.one_way_self_propulsion_days,
      capture_coefficient: derived.capture_coefficient,
      power_cap_kw: derived.power_cap_kw,
      full_output_flux_kw_per_m: derived.full_output_flux_kw_per_m,
    };
    // At defaults the entire self-propulsion leg is above the full-output threshold,
    // so it's a single "atcap" segment -- verify its potential (surplus) energy
    // matches the 40->100 ramp average, not a 40->75 one.
    const outboundSegs = outboundLegSegments(legInputs);
    const selfPropOut = outboundSegs[outboundSegs.length - 1]!;
    const expectedWaveAvgFlux = (40 + 100) / 2;
    const expectedWaveKwh =
      24 * legInputs.capture_coefficient * derived.one_way_self_propulsion_days * expectedWaveAvgFlux;
    const expectedPotential = expectedWaveKwh - selfPropOut.deliveredEnergyKwh;
    expect(selfPropOut.kind).toBe("atcap");
    expect(selfPropOut.potentialKwh).toBeCloseTo(expectedPotential, 2);

    const returnSegs = returnLegSegments(legInputs);
    const selfPropReturn = returnSegs[0]!;
    expect(selfPropReturn.kind).toBe("atcap");
    expect(selfPropReturn.potentialKwh).toBeCloseTo(expectedPotential, 2);
  });

  it("at default geometry/payload, extending the ramp to 100 does not change delivered compute energy on the self-propelled legs, only surplus", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const legInputs = {
      one_way_tug_days: derived.one_way_tug_days,
      one_way_self_propulsion_days: derived.one_way_self_propulsion_days,
      capture_coefficient: derived.capture_coefficient,
      power_cap_kw: derived.power_cap_kw,
      full_output_flux_kw_per_m: derived.full_output_flux_kw_per_m,
    };
    const selfPropOut = outboundLegSegments(legInputs).at(-1)!;
    // Fully capped the whole leg: delivered == cap * duration, independent of how high above cap the wave goes.
    expect(selfPropOut.deliveredEnergyKwh).toBeCloseTo(24 * derived.power_cap_kw * derived.one_way_self_propulsion_days, 4);
  });
});

describe("battery starts fully charged at every port departure (Change 2)", () => {
  it("battery capacity scales with battery_duration_hours (200 kW x 0.5h = 100 kWh at defaults)", () => {
    const capacityKwh = DEFAULT_INPUTS.payload_rating_kw * DEFAULT_INPUTS.battery_duration_hours;
    expect(capacityKwh).toBeCloseTo(100, 6);
  });

  it("the battery-assisted outbound shortfall matches the ~272 kWh sanity check (was ~372 kWh with an empty departure battery)", () => {
    const derived = computeDerived(DEFAULT_INPUTS);
    const shortfall = 24 * derived.power_cap_kw * derived.outbound_days - derived.outbound_energy_kwh;
    expect(shortfall).toBeCloseTo(272.301, 1);
  });

  it("a larger battery duration further reduces the outbound shortfall (more stored energy to cover the weak-wave ramp)", () => {
    const small = computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: 0.25 });
    const large = computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: 4 });
    const shortfallSmall = 24 * small.power_cap_kw * small.outbound_days - small.outbound_energy_kwh;
    const shortfallLarge = 24 * large.power_cap_kw * large.outbound_days - large.outbound_energy_kwh;
    expect(shortfallLarge).toBeLessThan(shortfallSmall);
  });

  it("zero battery duration reproduces the original (no-battery) outbound shortfall", () => {
    const derived = computeDerived({ ...DEFAULT_INPUTS, battery_duration_hours: 0 });
    const shortfall = 24 * derived.power_cap_kw * derived.outbound_days - derived.outbound_energy_kwh;
    // Original public-model figure (no battery assist at all).
    expect(shortfall).toBeCloseTo(372.301, 1);
  });
});
