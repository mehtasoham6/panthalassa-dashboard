import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRESTRIAL_INPUTS,
  MODEL_CONSTANTS,
  TERRESTRIAL_POWER_SOURCE_SPECS,
  runTerrestrialModel,
  type TerrestrialModelInputs,
  type TerrestrialPowerSource,
} from "../../src/terrestrial/model/index.js";
import { POWER_SOURCE_SLIDER_GROUPS, TERRESTRIAL_POWER_SOURCE_OPTIONS } from "../../src/terrestrial/integration/index.js";

const RENEWABLE_SOURCES: TerrestrialPowerSource[] = ["solar", "wind_onshore", "wind_offshore", "geothermal"];
const ALL_SOURCES: TerrestrialPowerSource[] = ["ccgt", ...RENEWABLE_SOURCES];

function inputsFor(source: TerrestrialPowerSource): TerrestrialModelInputs {
  return { ...DEFAULT_TERRESTRIAL_INPUTS, power_source: source, ...TERRESTRIAL_POWER_SOURCE_SPECS[source].defaults };
}

describe("power-source selector: five technologies produce comparable, finite, self-consistent outputs", () => {
  it("every technology has an entry in both the spec map and the button-option list, in the same set", () => {
    const specKeys = new Set(Object.keys(TERRESTRIAL_POWER_SOURCE_SPECS));
    const optionKeys = new Set(TERRESTRIAL_POWER_SOURCE_OPTIONS.map((o) => o.key));
    const sliderGroupKeys = new Set(Object.keys(POWER_SOURCE_SLIDER_GROUPS));
    expect(specKeys).toEqual(new Set(ALL_SOURCES));
    expect(optionKeys).toEqual(new Set(ALL_SOURCES));
    expect(sliderGroupKeys).toEqual(new Set(ALL_SOURCES));
  });

  it("every non-CCGT technology's own defaults fall within that technology's own slider range", () => {
    for (const source of RENEWABLE_SOURCES) {
      const group = POWER_SOURCE_SLIDER_GROUPS[source];
      for (const slider of group.sliders) {
        const value = TERRESTRIAL_POWER_SOURCE_SPECS[source].defaults[slider.key];
        expect(value).toBeGreaterThanOrEqual(slider.min);
        expect(value).toBeLessThanOrEqual(slider.max);
      }
    }
  });

  it("every non-CCGT technology burns zero natural gas", () => {
    for (const source of RENEWABLE_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      expect(r.energy.annual_natural_gas_mmbtu).toBe(0);
      expect(r.energy.analysis_period_natural_gas_mmbtu).toBe(0);
      expect(r.energy.analysis_period_natural_gas_bcf).toBe(0);
    }
  });

  it("every technology's present-value categories sum exactly to the present-value total (six-way split, by construction)", () => {
    for (const source of ALL_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      const sum =
        r.presentValue.present_value_power_plant_cost_usd +
        r.presentValue.present_value_fuel_cost_usd +
        r.presentValue.present_value_data_center_cost_usd +
        r.presentValue.present_value_chips_cost_usd +
        r.presentValue.present_value_other_opex_cost_usd +
        r.presentValue.present_value_workload_data_transfer_cost_usd;
      expect(sum).toBeCloseTo(r.presentValue.present_value_total_lifecycle_cost_usd, 4);
    }
  });

  it("every non-CCGT technology's present-value fuel category is exactly zero (no fuel cost for any renewable/geothermal source)", () => {
    for (const source of RENEWABLE_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      expect(r.presentValue.present_value_fuel_cost_usd).toBe(0);
    }
  });

  it("every technology produces finite, positive scalars across capacity/cost/LCOE", () => {
    for (const source of ALL_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      const scalars = [
        r.capacity.power_plant_nameplate_capacity_mw,
        r.costs.total_lifecycle_cost_usd,
        r.presentValue.present_value_total_lifecycle_cost_usd,
        r.lcoe.lcoe_usd_per_mwh,
        r.comparable.lifecycle_cost_per_target_watt_usd,
      ];
      for (const value of scalars) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it("nameplate capacity is average facility load divided by capacity factor for every renewable/geothermal source (energy-balance sizing)", () => {
    for (const source of RENEWABLE_SOURCES) {
      const inputs = inputsFor(source);
      const r = runTerrestrialModel(inputs);
      const expectedNameplateMw = r.capacity.average_facility_electrical_load_mw / inputs.renewable_capacity_factor;
      expect(r.capacity.power_plant_nameplate_capacity_mw).toBeCloseTo(expectedNameplateMw, 6);
    }
  });

  it("a lower capacity factor requires strictly more nameplate capacity and raises power-plant capex, holding capex/kW fixed", () => {
    for (const source of RENEWABLE_SOURCES) {
      const base = runTerrestrialModel(inputsFor(source));
      const worseSite = runTerrestrialModel({
        ...inputsFor(source),
        renewable_capacity_factor: TERRESTRIAL_POWER_SOURCE_SPECS[source].defaults.renewable_capacity_factor! * 0.8,
      });
      expect(worseSite.capacity.power_plant_nameplate_capacity_mw).toBeGreaterThan(base.capacity.power_plant_nameplate_capacity_mw);
      expect(worseSite.costs.initial.power_plant_capex_usd).toBeGreaterThan(base.costs.initial.power_plant_capex_usd);
    }
  });

  it("does not affect compute capex, data-center facility capex, or workload cost -- only the power-plant side changes across technologies", () => {
    const ccgt = runTerrestrialModel(inputsFor("ccgt"));
    for (const source of RENEWABLE_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      expect(r.costs.initial.compute_hardware_capex_usd).toBeCloseTo(ccgt.costs.initial.compute_hardware_capex_usd, 4);
      expect(r.costs.initial.facility_capex_usd).toBeCloseTo(ccgt.costs.initial.facility_capex_usd, 4);
      expect(r.costs.annual_steady_state.workload_data_transfer_usd).toBeCloseTo(ccgt.costs.annual_steady_state.workload_data_transfer_usd, 4);
      expect(r.energy.analysis_period_delivered_compute_mwh).toBeCloseTo(ccgt.energy.analysis_period_delivered_compute_mwh, 4);
    }
  });
});

describe("power-source regression figures at each technology's own defaults (5.5% discount rate, 1 GW / 5-year reference case)", () => {
  it("Solar (with battery): nameplate 4,800 MW, present-value lifecycle cost ~$53.134B", () => {
    const r = runTerrestrialModel(inputsFor("solar"));
    expect(r.capacity.power_plant_nameplate_capacity_mw).toBeCloseTo(4_800, 6);
    expect(r.presentValue.present_value_total_lifecycle_cost_usd / 1e9).toBeCloseTo(53.134, 2);
  });

  it("Onshore Wind (with battery): nameplate ~2,790.7 MW, present-value lifecycle cost ~$50.839B", () => {
    const r = runTerrestrialModel(inputsFor("wind_onshore"));
    expect(r.capacity.power_plant_nameplate_capacity_mw).toBeCloseTo(2_790.6976744186045, 4);
    expect(r.presentValue.present_value_total_lifecycle_cost_usd / 1e9).toBeCloseTo(50.839, 2);
  });

  it("Offshore Wind (with battery): nameplate 2,400 MW, present-value lifecycle cost ~$59.720B", () => {
    const r = runTerrestrialModel(inputsFor("wind_offshore"));
    expect(r.capacity.power_plant_nameplate_capacity_mw).toBeCloseTo(2_400, 6);
    expect(r.presentValue.present_value_total_lifecycle_cost_usd / 1e9).toBeCloseTo(59.720, 2);
  });

  it("Geothermal: nameplate ~1,411.8 MW (same ratio as CCGT: 0.85 availability vs 0.85 capacity factor), present-value lifecycle cost ~$51.219B", () => {
    const r = runTerrestrialModel(inputsFor("geothermal"));
    expect(r.capacity.power_plant_nameplate_capacity_mw).toBeCloseTo(1_411.764705882353, 6);
    expect(r.presentValue.present_value_total_lifecycle_cost_usd / 1e9).toBeCloseTo(51.219, 2);
  });

  it("all four renewable/geothermal technologies cost more than CCGT at these defaults (higher capex/kW and/or lower capacity factor than CCGT's mature-technology economics)", () => {
    const ccgt = runTerrestrialModel(inputsFor("ccgt"));
    for (const source of RENEWABLE_SOURCES) {
      const r = runTerrestrialModel(inputsFor(source));
      expect(r.presentValue.present_value_total_lifecycle_cost_usd).toBeGreaterThan(ccgt.presentValue.present_value_total_lifecycle_cost_usd);
    }
  });
});

describe("storage (battery) handling for Solar/Onshore Wind/Offshore Wind", () => {
  it("power-plant capex includes battery capex at Lazard's 50%-of-capacity/4-hour ratio (2 kWh per kW of generation nameplate)", () => {
    for (const source of ["solar", "wind_onshore", "wind_offshore"] as const) {
      const inputs = inputsFor(source);
      const r = runTerrestrialModel(inputs);
      const nameplateKw = r.capacity.power_plant_nameplate_capacity_mw * 1_000;
      const generationCapex = nameplateKw * inputs.renewable_capex_usd_per_kw;
      const storageKwh = nameplateKw * MODEL_CONSTANTS.renewable_storage_kwh_per_kw;
      const storageCapex = storageKwh * inputs.renewable_storage_capex_usd_per_kwh;
      expect(r.costs.initial.power_plant_capex_usd).toBeCloseTo(generationCapex + storageCapex, 2);
    }
  });

  it("Geothermal carries no battery: power-plant capex is generation-only", () => {
    const inputs = inputsFor("geothermal");
    const r = runTerrestrialModel(inputs);
    const nameplateKw = r.capacity.power_plant_nameplate_capacity_mw * 1_000;
    expect(r.costs.initial.power_plant_capex_usd).toBeCloseTo(nameplateKw * inputs.renewable_capex_usd_per_kw, 2);
  });

  it("a larger battery (higher storage capex/kWh) raises total lifecycle cost only for the three battery-paired sources", () => {
    for (const source of ["solar", "wind_onshore", "wind_offshore"] as const) {
      const base = runTerrestrialModel(inputsFor(source));
      const pricier = runTerrestrialModel({ ...inputsFor(source), renewable_storage_capex_usd_per_kwh: 365 });
      expect(pricier.costs.total_lifecycle_cost_usd).toBeGreaterThan(base.costs.total_lifecycle_cost_usd);
    }
    // Geothermal has no storage slider effect (the field is simply unused).
    const geoBase = runTerrestrialModel(inputsFor("geothermal"));
    const geoChanged = runTerrestrialModel({ ...inputsFor("geothermal"), renewable_storage_capex_usd_per_kwh: 365 });
    expect(geoChanged.costs.total_lifecycle_cost_usd).toBe(geoBase.costs.total_lifecycle_cost_usd);
  });
});

describe("Geothermal's variable O&M (its closest analog to fuel)", () => {
  it("raises total cost, and only geothermal responds to it", () => {
    const base = runTerrestrialModel(inputsFor("geothermal"));
    const higher = runTerrestrialModel({ ...inputsFor("geothermal"), geothermal_variable_om_usd_per_mwh: 24.80 });
    expect(higher.costs.total_lifecycle_cost_usd).toBeGreaterThan(base.costs.total_lifecycle_cost_usd);

    for (const source of ["solar", "wind_onshore", "wind_offshore"] as const) {
      const sourceBase = runTerrestrialModel(inputsFor(source));
      const sourceChanged = runTerrestrialModel({ ...inputsFor(source), geothermal_variable_om_usd_per_mwh: 24.80 });
      expect(sourceChanged.costs.total_lifecycle_cost_usd).toBe(sourceBase.costs.total_lifecycle_cost_usd);
    }
  });
});

describe("switching power_source resets only that technology's own sliders", () => {
  it("TERRESTRIAL_POWER_SOURCE_SPECS defaults, applied on top of any prior scenario, always yield that technology's own baseline numbers", () => {
    // Simulates the App.tsx power-source switch handler: spread the new
    // technology's defaults over an arbitrary prior state.
    const arbitraryPriorState: TerrestrialModelInputs = {
      ...inputsFor("wind_offshore"),
      renewable_capex_usd_per_kw: 6_900, // user had been exploring a high offshore capex scenario
    };
    const switchedToSolar: TerrestrialModelInputs = {
      ...arbitraryPriorState,
      power_source: "solar",
      ...TERRESTRIAL_POWER_SOURCE_SPECS.solar.defaults,
    };
    const freshSolar = inputsFor("solar");
    // Every field the Solar slider group actually reads must land at Solar's own default, not the leftover offshore value.
    for (const slider of POWER_SOURCE_SLIDER_GROUPS.solar.sliders) {
      expect(switchedToSolar[slider.key]).toBe(freshSolar[slider.key]);
    }
    expect(runTerrestrialModel(switchedToSolar).presentValue.present_value_total_lifecycle_cost_usd).toBeCloseTo(
      runTerrestrialModel(freshSolar).presentValue.present_value_total_lifecycle_cost_usd,
      2,
    );
  });

  it("power-source-independent sliders (discount rate, PUE, facility capex, chip failure rate) are NOT reset on a power-source switch", () => {
    const customized: TerrestrialModelInputs = { ...inputsFor("ccgt"), real_discount_rate: 0.08, pue: 1.35 };
    const switchedToWind: TerrestrialModelInputs = {
      ...customized,
      power_source: "wind_onshore",
      ...TERRESTRIAL_POWER_SOURCE_SPECS.wind_onshore.defaults,
    };
    expect(switchedToWind.real_discount_rate).toBe(0.08);
    expect(switchedToWind.pue).toBe(1.35);
  });
});
