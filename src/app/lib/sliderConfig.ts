import type { ModelInputs } from "../../model/index.js";

/** Compact "$50k"-style formatting for large round-thousands cost sliders. Display only -- calculations always use the raw dollar value. */
const formatCompactUsd = (raw: number): string => `$${Math.round(raw / 1000)}k`;

export interface SliderConfig {
  key: keyof ModelInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Displayed/edited value is raw * displayScale (e.g. fractions shown as %). */
  displayScale?: number;
  decimals?: number;
  helpText?: string;
  /** Overrides the default numeric formatting (e.g. compact "$50k" instead of "50000"). Calculations always use the raw value. */
  format?: (raw: number) => string;
}

export interface SliderGroupConfig {
  title: string;
  sliders: SliderConfig[];
}

/**
 * The four inputs that genuinely drive both architectures identically.
 * Deliberately not part of either architecture's own slider groups --
 * rendered once, in SharedInputsPanel, between the two.
 */
export const SHARED_SLIDERS: SliderConfig[] = [
  {
    key: "target_capacity_gw",
    label: "Target capacity",
    unit: "GW",
    min: 0.1,
    max: 100,
    step: 0.1,
    default: 1,
    decimals: 1,
    helpText: "Average delivered compute over analysis period",
  },
  {
    key: "analysis_period_years",
    label: "Analysis period",
    unit: "years",
    min: 3,
    max: 15,
    step: 1,
    default: 5,
    decimals: 0,
    helpText: "Window over which total lifecycle cost and delivered energy are counted",
  },
  {
    key: "compute_hardware_cost_usd_per_kw",
    label: "Compute hardware cost",
    unit: "$ / W",
    min: 5_000,
    max: 50_000,
    step: 1_000,
    default: 25_000,
    displayScale: 0.001,
    decimals: 0,
  },
  {
    key: "workloadBandwidthIntensityMbpsPerKw",
    label: "Workload bandwidth intensity",
    unit: "Mbps / kW",
    min: 0.005,
    max: 0.10,
    step: 0.005,
    default: 0.03,
    decimals: 3,
    helpText: "Identical external workload traffic intensity; transport prices remain architecture-specific",
  },
];

export const SLIDER_GROUPS: SliderGroupConfig[] = [
  {
    title: "Economics",
    sliders: [
      {
        key: "real_discount_rate",
        label: "Discount rate",
        unit: "%",
        min: 0.02,
        max: 0.1,
        step: 0.005,
        default: 0.08,
        displayScale: 100,
        decimals: 1,
      },
    ],
  },
  {
    title: "Node physical design",
    sliders: [
      {
        key: "payload_rating_kw",
        label: "Installed compute payload",
        unit: "kW",
        min: 100,
        max: 300,
        step: 10,
        default: 200,
        decimals: 0,
        helpText: "How much energy the chips aboard one node consumes",
      },
      {
        key: "hull_diameter_m",
        label: "Hull diameter",
        unit: "m",
        min: 10,
        max: 25,
        step: 1,
        default: 20,
        decimals: 0,
        helpText: "Affects both wave capture and structural mass (bigger hull = more captured power and more steel needed)",
      },
      {
        key: "battery_duration_hours",
        label: "Battery duration",
        unit: "hours",
        min: 0,
        max: 20,
        step: 0.25,
        default: 4,
        decimals: 2,
        helpText: "The amount of time the battery can power the payload when waves are insufficient",
      },
    ],
  },
  {
    title: "Operations & service",
    sliders: [
      {
        key: "sea_park_distance_km",
        label: "Distance from port to sea park",
        unit: "km",
        min: 500,
        max: 4000,
        step: 100,
        default: 800,
        decimals: 0,
        helpText: "The distance between the port the nodes launch from and the area of the ocean where the waves are optimal",
      },
      {
        key: "node_lifetime_years",
        label: "Node lifetime",
        unit: "years",
        min: 5,
        max: 30,
        step: 1,
        default: 20,
        decimals: 0,
        helpText: "Economic life of a node",
      },
    ],
  },
  {
    title: "Reliability",
    sliders: [
      {
        key: "chip_failure_rate_annual",
        label: "Chip degradation rate",
        unit: "% / server-yr",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        default: 0.01,
        displayScale: 100,
        decimals: 1,
        helpText: "The percentage of still-working compute hardware expected to fail each year and eventually need replacement",
      },
      {
        key: "hotSpareShare",
        label: "Hot spares",
        unit: "% of payload",
        min: 0,
        max: 0.2,
        step: 0.025,
        default: 0.1,
        displayScale: 100,
        decimals: 1,
        helpText: "Share of the installed computing capacity that can fail before triggering a service trip. This capacity also does work while healthy, so output declines as chips fail",
      },
      {
        key: "node_failure_rate_annual",
        label: "Unexpected node failure rate",
        unit: "% / node-yr",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        default: 0.03,
        displayScale: 100,
        decimals: 1,
        helpText: "The annual chance that a node suffers a serious hardware or mechanical failure (other than normal chip wear) that forces it out of service",
      },
    ],
  },
  {
    title: "Cost assumptions",
    sliders: [
      {
        key: "finished_hull_cost_usd_per_tonne",
        label: "Finished hull cost",
        unit: "$ / tonne",
        min: 1500,
        max: 10000,
        step: 500,
        default: 2000,
        decimals: 0,
        helpText: "Fabrication cost per tonne of finished structural steel",
      },
      {
        key: "pto_cost_usd_per_kw",
        label: "PTO cost",
        unit: "$ / kW",
        min: 50,
        max: 500,
        step: 25,
        default: 200,
        decimals: 0,
        helpText: "Power take-off (generator) cost per kW of installed PTO rating (PTO is sized at 1.5x payload)",
      },
      {
        key: "mode23RepairCostUsd",
        label: "Node Repair Cost",
        unit: "/ event",
        min: 20_000,
        max: 500_000,
        step: 10_000,
        default: 50_000,
        decimals: 0,
        format: formatCompactUsd,
        helpText: "Cost of parts and labor after a serious but recoverable node failure. Range: roughly small workboat repair to major commercial vessel repair",
      },
      {
        key: "tugCostUsdPerDay",
        label: "Tug Cost",
        unit: "per day",
        min: 5_000,
        max: 50_000,
        step: 1_000,
        default: 10_000,
        decimals: 0,
        format: formatCompactUsd,
        helpText: "Daily cost of hiring a tug to move or recover a node",
      },
    ],
  },
  {
    title: "Workload & data transfer",
    sliders: [
      {
        key: "dataTransferCostPerGb",
        label: "Data-transfer cost",
        unit: "$ / GB",
        min: 0.10,
        max: 2.00,
        step: 0.05,
        default: 1.0,
        decimals: 2,
        helpText: "Cost to move workload data off the node",
      },
    ],
  },
];

export const ALL_SLIDERS: SliderConfig[] = [...SHARED_SLIDERS, ...SLIDER_GROUPS.flatMap((g) => g.sliders)];
