import { DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS } from "../model/defaults.js";
import type { TerrestrialArchitectureInputs } from "../model/types.js";

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
  helpText: string;
}

export interface TerrestrialSliderGroupConfig {
  title: string;
  description: string;
  sliders: readonly NumericControlConfig<keyof TerrestrialArchitectureInputs>[];
}

/** Mirrors the ocean sidebar's grouped-slider-panel structure for visual symmetry. */
export const TERRESTRIAL_SLIDER_GROUPS: readonly TerrestrialSliderGroupConfig[] = [
  {
    title: "Economics",
    description: "The terrestrial plant's own real discount rate.",
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
        helpText: "Terrestrial-specific real discount rate: mature CCGT technology with investment-grade, contracted financing gets better 2026 terms than first-of-a-kind marine infrastructure.",
      },
    ],
  },
  {
    title: "Power system & fuel",
    description: "CCGT sizing, capital cost, efficiency, fuel price, and operating cost.",
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
        helpText: "Captive-baseload design factor used to oversize CCGT nameplate; not the observed grid-fleet dispatch factor.",
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
        helpText: "All-in plant EPC/BOP/development/interconnection scope, excluding construction financing.",
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
        helpText: "Plant-gate price including delivery; do not separately add transport.",
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
        helpText: "Physical operation/LTSA scope; taxes, insurance and corporate overhead are outside the comparison boundary.",
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
        helpText: "Terrestrial power-system LCOE horizon; paired conceptually with Panthalassa node life.",
      },
    ],
  },
  {
    title: "Facility",
    description: "Non-generation data-center build and physical maintenance.",
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
        helpText: "Total facility electricity divided by IT electricity.",
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
        helpText: "Electrical, mechanical/cooling, civil/shell and networking fit-out; excludes primary CCGT and active compute.",
      },
    ],
  },
  {
    title: "Reliability",
    description: "Terrestrial hardware failure behavior.",
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
        helpText: "Terrestrial-specific hardware hazard, replaced immediately/locally. Range spans a theoretical fleet floor (~1%) to a frontier continuous-training ceiling (~9%, Meta Llama 3).",
      },
    ],
  },
];

export const ALL_TERRESTRIAL_SLIDERS: readonly NumericControlConfig<keyof TerrestrialArchitectureInputs>[] =
  TERRESTRIAL_SLIDER_GROUPS.flatMap((g) => g.sliders);
