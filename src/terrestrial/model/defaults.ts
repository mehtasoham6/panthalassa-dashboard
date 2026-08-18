import type {
  LegacyMcCalipInputs,
  SharedComparisonInputs,
  TerrestrialArchitectureInputs,
  TerrestrialModelInputs,
} from "./types.js";

/** Exact matches for the four remaining Panthalassa controls that drive both architectures. */
export const DEFAULT_SHARED_COMPARISON_INPUTS: SharedComparisonInputs = {
  target_capacity_gw: 1,
  analysis_period_years: 5,
  compute_hardware_cost_usd_per_kw: 25_000,
  workloadBandwidthIntensityMbpsPerKw: 0.03,
};

/**
 * Consensus-refined terrestrial reference case; provenance is recorded in
 * docs/SOURCES_AND_ASSUMPTIONS.md.
 *
 * ccgt_capex_usd_per_kw was re-baselined from an earlier $1,800/kW (a
 * 2025-vintage generic new-build CCGT figure drawn from EIA/Brattle/Lazard
 * planning studies) to $2,300/kW to reflect the actual 2026 behind-the-meter
 * market: gas turbine prices are up roughly 195% over 2019 levels amid an
 * OEM backlog exceeding 100 GW (Wood Mackenzie/GE Vernova), and S&P Global's
 * dedicated data-center BTM case study puts realistic combined-cycle capex
 * at $2,293/kW. $2,300/kW is a rounded match to that figure and sits inside
 * the broader $2,000-2,500/kW range reported for recent projects. The other
 * CCGT/O&M/gas-price inputs are left as-is: search did not turn up
 * comparably specific, sourceable premiums for those line items the way it
 * did for capex, and this model would rather stay at a defensible generic
 * baseline than fabricate precision it can't back up. Even at this raised
 * default, LCOE (~$54/MWh) remains well under the $100-165/MWh reported for
 * real rushed/redundant BTM deals -- that residual gap is likely a
 * redundancy/overbuild premium and rush-financing cost this model doesn't
 * charge for at all, not a capex-only story.
 */
export const DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS: TerrestrialArchitectureInputs = {
  /**
   * 5.5% real. Blends 2026 investment-grade, long-term-contracted
   * data-center project debt (mid-5% to low-7% nominal, per 2026 financing
   * reporting) with a typical infrastructure-equity cost of capital, net of
   * ~2.3% expected inflation. Deliberately below Panthalassa's own (higher)
   * discount rate: mature CCGT technology paired with a creditworthy,
   * long-term-contracted off-taker gets meaningfully better financing terms
   * than first-of-a-kind marine infrastructure.
   */
  real_discount_rate: 0.055,
  /**
   * 4%/year. Bracketed by two sourced hyperscale GPU data points: a
   * theoretical FIT-rate floor of ~0.9%/year for a 10,000-GPU cluster, and
   * ~9%/year computed from Meta's Llama 3 405B training run (GPU + HBM3
   * memory failures over a 54-day, 16,384-H100 production run, annualized).
   * The 9% figure reflects a frontier, continuous, near-100%-utilization
   * training workload -- a stress ceiling, not a typical fleet average. 4%
   * is a normal mixed training/inference hyperscale default between that
   * floor and ceiling; see the slider range for the full bracket.
   */
  chip_failure_rate_annual: 0.04,
  pue: 1.20,
  power_system_availability: 0.85,
  ccgt_capex_usd_per_kw: 2_300,
  delivered_gas_price_usd_per_mmbtu: 4.00,
  ccgt_fixed_om_usd_per_kw_year: 20,
  ccgt_economic_life_years: 30,
  facility_capex_usd_per_it_watt: 12.50,
};

export const DEFAULT_TERRESTRIAL_INPUTS: TerrestrialModelInputs = {
  ...DEFAULT_SHARED_COMPARISON_INPUTS,
  ...DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
};

/** Exact public McCalip terrestrial defaults, retained only for reproduction testing. */
export const DEFAULT_LEGACY_MCCALIP_INPUTS: LegacyMcCalipInputs = {
  years: 5,
  targetGW: 1,
  gasTurbineCapexPerKW: 1_800,
  electricalCostPerW: 5.25,
  mechanicalCostPerW: 3.00,
  civilCostPerW: 2.50,
  networkCostPerW: 1.75,
  pue: 1.20,
  gasPricePerMMBtu: 4.30,
  heatRateBtuKwh: 6_200,
  capacityFactor: 0.85,
};

export const MODEL_CONSTANTS = {
  hours_per_year: 8_760,
  workload_data_transfer_gb_per_mbps_kwh: 0.45,
  /** EIA approximate average energy content used only to expose an indicative Bcf output. */
  natural_gas_btu_per_standard_cubic_foot: 1_037,
  /**
   * External workload transport OPEX, fixed rather than a slider: at any
   * plausible value in its former 0-0.05 $/GB range this line item is a
   * rounding error against a multi-billion-dollar lifecycle cost (well
   * under 0.01% of the reference-case total), so exposing it as a control
   * added a slider without adding a meaningful decision. Kept at its
   * previous default; see docs/SOURCES_AND_ASSUMPTIONS.md (TeleGeography
   * 2025 wholesale transit) for provenance.
   */
  terrestrial_data_transfer_cost_usd_per_gb: 0.001,
  /**
   * Six terrestrial inputs demoted from sliders to fixed constants (kept at
   * their previous default values, so no output changes): each one either
   * has essentially zero effect on any reachable dashboard output, or is a
   * narrow, low-leverage line item that isn't a meaningful scenario lever.
   * See docs/SOURCES_AND_ASSUMPTIONS.md for source-level provenance.
   *
   * - facility_economic_life_years / facility_decommissioning_fraction:
   *   only affect total_lifecycle_cost_usd if analysis_period_years reaches
   *   the facility's economic life -- structurally impossible, since the
   *   facility-life floor (20yr) exceeds the dashboard's analysis-period
   *   ceiling (15yr). These two controls could never visibly change
   *   anything.
   * - ccgt_decommissioning_fraction: does feed the LCOE calc (which always
   *   uses the CCGT's own economic-life horizon, independent of the
   *   analysis period), but as a one-time terminal charge on 0-5% of capex
   *   amortized over 20-40 years its effect on displayed LCOE is well
   *   under $1/MWh across the full range -- and it was already the
   *   lowest-confidence number in the sourcing table.
   * - ccgt_heat_rate_btu_per_kwh_hhv: real-world CCGT heat rates cluster
   *   tightly (6,200-6,800 Btu/kWh); it's a narrow engineering efficiency
   *   spec, not something a dashboard user is equipped to reason about as
   *   a scenario choice.
   * - facility_maintenance_usd_per_it_kw_year: ~$28M/yr at the reference
   *   case, 0.30% of total lifecycle cost. Panthalassa doesn't expose its
   *   analogous scheduled-maintenance cost fraction as a slider either --
   *   this brings terrestrial to the same information-density bar.
   * - ccgt_variable_om_usd_per_mwh: ~$37M/yr, 0.39% of total, and the
   *   proportionally narrowest range of any terrestrial slider (2.5-5.0, a
   *   2x spread vs. ccgt_fixed_om_usd_per_kw_year's 6x) -- fixed O&M is the
   *   one with real scenario-exploration value and stays a slider.
   */
  ccgt_heat_rate_btu_per_kwh_hhv: 6_400,
  ccgt_variable_om_usd_per_mwh: 3.50,
  facility_maintenance_usd_per_it_kw_year: 67,
  facility_economic_life_years: 25,
  ccgt_decommissioning_fraction: 0.01,
  facility_decommissioning_fraction: 0.01,
} as const;
