import { DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS } from "../model/defaults.js";
import type { TerrestrialArchitectureInputs, TerrestrialPowerSource } from "../model/types.js";

export interface NumericControlConfig<K extends string> {
  key: K;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  displayScale?: number;
  decimals?: number;
  helpText?: string;
}

export interface TerrestrialSliderGroupConfig {
  title: string;
  sliders: readonly NumericControlConfig<keyof TerrestrialArchitectureInputs>[];
}

/** Power-source-independent groups: shown regardless of which power_source is selected. */
export const TERRESTRIAL_ALWAYS_VISIBLE_SLIDER_GROUPS: readonly TerrestrialSliderGroupConfig[] = [
  {
    title: "Economics",
    sliders: [
      {
        key: "real_discount_rate",
        label: "Discount rate",
        unit: "% real",
        min: 0.02,
        max: 0.10,
        step: 0.005,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.real_discount_rate,
        displayScale: 100,
        decimals: 1,
      },
    ],
  },
  {
    title: "Facility",
    sliders: [
      {
        key: "pue",
        label: "PUE",
        unit: "ratio",
        min: 1.08,
        max: 1.50,
        step: 0.01,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.pue,
        decimals: 2,
        helpText: "Total facility electricity divided by IT electricity",
      },
      {
        key: "facility_capex_usd_per_it_watt",
        label: "Data-center facility capex",
        unit: "$ / IT W",
        min: 9,
        max: 16,
        step: 0.25,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.facility_capex_usd_per_it_watt,
        decimals: 2,
        helpText: "Electrical, mechanical/cooling, civil/shell and networking fit-out; excludes primary generation and active compute",
      },
    ],
  },
  {
    title: "Reliability",
    sliders: [
      {
        key: "chip_failure_rate_annual",
        label: "Chip degradation/failure rate",
        unit: "% / server-yr",
        min: 0.01,
        max: 0.09,
        step: 0.005,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.chip_failure_rate_annual,
        displayScale: 100,
        decimals: 1,
        helpText: "Terrestrial-specific hardware hazard, replaced immediately/locally. Range spans a theoretical fleet floor (~1%) to a frontier continuous-training ceiling (~9%, Meta Llama 3)",
      },
    ],
  },
];

/**
 * One slider group per power source -- swapped in below the always-visible
 * groups depending on the "Power source" selector. Renewable capex/O&M/
 * capacity-factor ranges are sourced from Lazard's LCOE+ v19.0 (July 2026);
 * see TERRESTRIAL_POWER_SOURCE_SPECS for provenance notes.
 */
export const POWER_SOURCE_SLIDER_GROUPS: Record<TerrestrialPowerSource, TerrestrialSliderGroupConfig> = {
  ccgt: {
    title: "Power system & fuel",
    sliders: [
      {
        key: "power_system_availability",
        label: "Power-system availability",
        unit: "%",
        min: 0.75,
        max: 0.92,
        step: 0.01,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.power_system_availability,
        displayScale: 100,
        decimals: 0,
        helpText: "Captive-baseload design factor used to oversize CCGT nameplate; not the observed grid-fleet dispatch factor",
      },
      {
        key: "ccgt_capex_usd_per_kw",
        label: "CCGT overnight capex",
        unit: "$ / kW",
        min: 1_000,
        max: 2_600,
        step: 50,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_capex_usd_per_kw,
        decimals: 0,
        helpText: "All-in plant EPC/BOP/development/interconnection scope, excluding construction financing",
      },
      {
        key: "delivered_gas_price_usd_per_mmbtu",
        label: "Delivered natural-gas price",
        unit: "$ / MMBtu",
        min: 2.50,
        max: 8.00,
        step: 0.10,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.delivered_gas_price_usd_per_mmbtu,
        decimals: 2,
        helpText: "Plant-gate price including delivery",
      },
      {
        key: "ccgt_fixed_om_usd_per_kw_year",
        label: "CCGT fixed O&M",
        unit: "$ / kW-yr",
        min: 10,
        max: 60,
        step: 1,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_fixed_om_usd_per_kw_year,
        decimals: 0,
        helpText: "Physical operation/LTSA scope; taxes, insurance and corporate overhead are outside the comparison boundary",
      },
      {
        key: "ccgt_economic_life_years",
        label: "CCGT economic life",
        unit: "years",
        min: 20,
        max: 40,
        step: 1,
        default: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_economic_life_years,
        decimals: 0,
      },
    ],
  },
  solar: {
    title: "Power system",
    sliders: [
      {
        key: "renewable_capex_usd_per_kw",
        label: "Solar overnight capex",
        unit: "$ / kW",
        min: 1_250,
        max: 1_850,
        step: 25,
        default: 1_550,
        decimals: 0,
        helpText: "Utility-scale solar PV capital cost (Lazard LCOE+ v19.0)",
      },
      {
        key: "renewable_fixed_om_usd_per_kw_year",
        label: "Solar fixed O&M",
        unit: "$ / kW-yr",
        min: 8.25,
        max: 26.25,
        step: 0.25,
        default: 17,
        decimals: 2,
        helpText: "Fixed operations and maintenance for the solar array",
      },
      {
        key: "renewable_capacity_factor",
        label: "Solar capacity factor",
        unit: "%",
        min: 0.20,
        max: 0.30,
        step: 0.01,
        default: 0.25,
        displayScale: 100,
        decimals: 0,
        helpText: "Average power output compared to maximum possible output",
      },
      {
        key: "renewable_storage_capex_usd_per_kwh",
        label: "Battery capex",
        unit: "$ / kWh",
        min: 270,
        max: 365,
        step: 5,
        default: 318,
        decimals: 0,
        helpText: "Battery sized at 50% of solar capacity, 4-hour duration (Lazard's Solar + Storage configuration)",
      },
    ],
  },
  wind_onshore: {
    title: "Power system",
    sliders: [
      {
        key: "renewable_capex_usd_per_kw",
        label: "Onshore wind overnight capex",
        unit: "$ / kW",
        min: 1_900,
        max: 2_750,
        step: 25,
        default: 2_325,
        decimals: 0,
        helpText: "Onshore wind capital cost (Lazard LCOE+ v19.0)",
      },
      {
        key: "renewable_fixed_om_usd_per_kw_year",
        label: "Onshore wind fixed O&M",
        unit: "$ / kW-yr",
        min: 24.50,
        max: 40.00,
        step: 0.50,
        default: 32,
        decimals: 2,
        helpText: "Fixed operations and maintenance for the wind farm",
      },
      {
        key: "renewable_capacity_factor",
        label: "Onshore wind capacity factor",
        unit: "%",
        min: 0.30,
        max: 0.55,
        step: 0.01,
        default: 0.43,
        displayScale: 100,
        decimals: 0,
        helpText: "Average power output compared to maximum possible output",
      },
      {
        key: "renewable_storage_capex_usd_per_kwh",
        label: "Battery capex",
        unit: "$ / kWh",
        min: 270,
        max: 365,
        step: 5,
        default: 318,
        decimals: 0,
        helpText: "Battery sized at 50% of wind capacity, 4-hour duration (Lazard's Wind + Storage configuration)",
      },
    ],
  },
  wind_offshore: {
    title: "Power system",
    sliders: [
      {
        key: "renewable_capex_usd_per_kw",
        label: "Offshore wind overnight capex",
        unit: "$ / kW",
        min: 5_600,
        max: 7_100,
        step: 50,
        default: 6_350,
        decimals: 0,
        helpText: "Offshore wind capital cost (Lazard LCOE+ v19.0)",
      },
      {
        key: "renewable_fixed_om_usd_per_kw_year",
        label: "Offshore wind fixed O&M",
        unit: "$ / kW-yr",
        min: 60.00,
        max: 91.50,
        step: 1,
        default: 76,
        decimals: 2,
        helpText: "Fixed operations and maintenance for the offshore wind farm",
      },
      {
        key: "renewable_capacity_factor",
        label: "Offshore wind capacity factor",
        unit: "%",
        min: 0.45,
        max: 0.55,
        step: 0.01,
        default: 0.50,
        displayScale: 100,
        decimals: 0,
        helpText: "Average power output compared to maximum possible output",
      },
      {
        key: "renewable_storage_capex_usd_per_kwh",
        label: "Battery capex",
        unit: "$ / kWh",
        min: 270,
        max: 365,
        step: 5,
        default: 318,
        decimals: 0,
        helpText: "Battery sized at 50% of wind capacity, 4-hour duration; $/kWh reused from Lazard's onshore Wind + Storage table",
      },
    ],
  },
  geothermal: {
    title: "Power system",
    sliders: [
      {
        key: "renewable_capex_usd_per_kw",
        label: "Geothermal overnight capex",
        unit: "$ / kW",
        min: 5_135,
        max: 6_635,
        step: 50,
        default: 5_885,
        decimals: 0,
        helpText: "Geothermal capital cost (Lazard LCOE+ v19.0)",
      },
      {
        key: "renewable_fixed_om_usd_per_kw_year",
        label: "Geothermal fixed O&M",
        unit: "$ / kW-yr",
        min: 14.50,
        max: 15.75,
        step: 0.05,
        default: 15,
        decimals: 2,
        helpText: "Fixed operations and maintenance for the geothermal plant",
      },
      {
        key: "renewable_capacity_factor",
        label: "Geothermal capacity factor",
        unit: "%",
        min: 0.80,
        max: 0.90,
        step: 0.01,
        default: 0.85,
        displayScale: 100,
        decimals: 0,
        helpText: "Average power output compared to maximum possible output",
      },
      {
        key: "geothermal_variable_om_usd_per_mwh",
        label: "Geothermal variable O&M",
        unit: "$ / MWh",
        min: 9.05,
        max: 24.80,
        step: 0.25,
        default: 17,
        decimals: 2,
        helpText: "Output-linked operating cost -- geothermal's closest analog to fuel",
      },
    ],
  },
};

export interface PowerSourceOption {
  key: TerrestrialPowerSource;
  label: string;
  /** CSS color for the selector button. */
  color: string;
}

/** Colors chosen per explicit request: orange/CCGT, light green/Solar, light gray/Onshore, darker gray/Offshore, light red/Geothermal. */
export const TERRESTRIAL_POWER_SOURCE_OPTIONS: readonly PowerSourceOption[] = [
  { key: "ccgt", label: "Gas", color: "var(--power-ccgt)" },
  { key: "solar", label: "Solar (with battery)", color: "var(--power-solar)" },
  { key: "wind_onshore", label: "Onshore Wind (with battery)", color: "var(--power-wind-onshore)" },
  { key: "wind_offshore", label: "Offshore Wind (with battery)", color: "var(--power-wind-offshore)" },
  { key: "geothermal", label: "Geothermal", color: "var(--power-geothermal)" },
];

/** All sliders relevant to the currently selected power source, for the "Baseline vs. current" diff. */
export function getRelevantTerrestrialSliderGroups(powerSource: TerrestrialPowerSource): readonly TerrestrialSliderGroupConfig[] {
  return [...TERRESTRIAL_ALWAYS_VISIBLE_SLIDER_GROUPS, POWER_SOURCE_SLIDER_GROUPS[powerSource]];
}

/** Every slider across every power source -- used only where a technology-agnostic superset is needed. */
export const ALL_TERRESTRIAL_SLIDERS: readonly NumericControlConfig<keyof TerrestrialArchitectureInputs>[] = [
  ...TERRESTRIAL_ALWAYS_VISIBLE_SLIDER_GROUPS.flatMap((g) => g.sliders),
  ...Object.values(POWER_SOURCE_SLIDER_GROUPS).flatMap((g) => g.sliders),
];
