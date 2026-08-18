import { DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS } from "./defaults.js";
import type { TerrestrialArchitectureInputs } from "./types.js";

export interface ModelSource {
  id: string;
  organization: string;
  title: string;
  publicationYear: number;
  url: string;
  sourceType: "original-model" | "government" | "system-operator" | "industry-study" | "operator-disclosure";
}

export interface AssumptionProvenance {
  input: keyof TerrestrialArchitectureInputs;
  defaultValue: number;
  unit: string;
  sourceIds: string[];
  useInModel: string;
  interpretation: string;
  confidence: "high" | "medium" | "low";
}

/** Machine-readable companion to docs/SOURCES_AND_ASSUMPTIONS.md. */
export const MODEL_SOURCES: readonly ModelSource[] = [
  {
    id: "panthalassa_frozen_model",
    organization: "Panthalassa dashboard",
    title: "Panthalassa Wave-Powered Data-Center Model, frozen comparison reference",
    publicationYear: 2026,
    url: "https://github.com/mehtasoham6/panthalassa-dashboard/",
    sourceType: "original-model",
  },
  {
    id: "mccalip_public_model",
    organization: "Andrew McCalip",
    title: "Space Datacenters: Orbital vs Terrestrial Economics",
    publicationYear: 2025,
    url: "https://github.com/andrewmccalip/thoughts",
    sourceType: "original-model",
  },
  {
    id: "eia_aeo2025_capital",
    organization: "U.S. Energy Information Administration / Sargent & Lundy",
    title: "Capital Cost and Performance Characteristics for Utility-Scale Electric Power Generating Technologies",
    publicationYear: 2024,
    url: "https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2025.pdf",
    sourceType: "government",
  },
  {
    id: "brattle_pjm_cone_2025",
    organization: "The Brattle Group / Sargent & Lundy / PJM",
    title: "Brattle 2025 CONE Report for PJM",
    publicationYear: 2025,
    url: "https://www.brattle.com/wp-content/uploads/2025/04/Brattle-2025-CONE-Report-for-PJM.pdf",
    sourceType: "system-operator",
  },
  {
    id: "lazard_lcoe_2026",
    organization: "Lazard",
    title: "Levelized Cost of Energy+ Version 19.0",
    publicationYear: 2026,
    url: "https://www.lazard.com/media/kcfconhf/lazards-lcoeplus_vf.pdf",
    sourceType: "industry-study",
  },
  {
    id: "eia_delivered_gas_2025",
    organization: "U.S. Energy Information Administration",
    title: "Natural Gas Electric Power Price",
    publicationYear: 2026,
    url: "https://www.eia.gov/dnav/ng/ng_sum_lsum_a_epg0_peu_dmcf_a.htm",
    sourceType: "government",
  },
  {
    id: "eia_delivered_gas_definition",
    organization: "U.S. Energy Information Administration",
    title: "What is the price or cost of natural gas for U.S. electric power producers?",
    publicationYear: 2026,
    url: "https://www.eia.gov/tools/faqs/faq.php?id=51&t=8",
    sourceType: "government",
  },
  {
    id: "eia_ccgt_capacity_factor_2025",
    organization: "U.S. Energy Information Administration",
    title: "Electric Power Monthly, Table 6.07.A",
    publicationYear: 2026,
    url: "https://www.eia.gov/electricity/monthly/epm_table_grapher.php?lang=en&t=table_6_07_a",
    sourceType: "government",
  },
  {
    id: "microsoft_pue_fy2025",
    organization: "Microsoft",
    title: "Measuring energy and water efficiency for Microsoft datacenters",
    publicationYear: 2026,
    url: "https://datacenters.microsoft.com/sustainability/efficiency/",
    sourceType: "operator-disclosure",
  },
  {
    id: "uptime_survey_2025",
    organization: "Uptime Institute",
    title: "Global Data Center Survey 2025",
    publicationYear: 2025,
    url: "https://datacenter.uptimeinstitute.com/rs/711-RIA-145/images/2025.Annual.Survey.Report.pdf?version=0",
    sourceType: "industry-study",
  },
  {
    id: "turner_townsend_2025",
    organization: "Turner & Townsend",
    title: "Data Centre Construction Cost Index 2025",
    publicationYear: 2025,
    url: "https://reports.turnerandtownsend.com/data-centre-construction-cost-index-2025/data-centre-cost-trends",
    sourceType: "industry-study",
  },
  {
    id: "jll_outlook_2026",
    organization: "JLL",
    title: "2026 Market Outlook for Global Data Centers",
    publicationYear: 2026,
    url: "https://www.jll.com/en-us/insights/market-outlook/data-center-outlook",
    sourceType: "industry-study",
  },
  {
    id: "kpmg_costs_2026",
    organization: "KPMG",
    title: "Benchmarking CapEx and OpEx in the Global Data Centre Market",
    publicationYear: 2026,
    url: "https://assets.kpmg.com/content/dam/kpmgsites/sg/pdf/2026/05/benchmarking-capex-and-opex-in-the-global-data-centre-market.pdf.coredownload.inline.pdf",
    sourceType: "industry-study",
  },
  {
    id: "meta_asset_lives",
    organization: "Meta Platforms / U.S. SEC",
    title: "Property and Equipment Useful-Life Disclosure",
    publicationYear: 2023,
    url: "https://www.sec.gov/Archives/edgar/data/1326801/000132680123000013/R26.htm",
    sourceType: "operator-disclosure",
  },
  {
    id: "telegeography_transit_2025",
    organization: "TeleGeography",
    title: "IP Transit Price Erosion: Significant Regional Differences Remain",
    publicationYear: 2025,
    url: "https://resources.telegeography.com/ip-transit-price-erosion-significant-regional-differences-remain",
    sourceType: "industry-study",
  },
  {
    id: "sp_global_btm_2026",
    organization: "S&P Global Market Intelligence",
    title: "Data center power: combined-cycle plant outperforms solar-plus-battery",
    publicationYear: 2026,
    url: "https://www.spglobal.com/market-intelligence/en/news-insights/research/2026/03/data-center-power-combined-cycle-plant-outperforms-solar-plus-battery",
    sourceType: "industry-study",
  },
  {
    id: "woodmac_turbine_pricing_2026",
    organization: "Wood Mackenzie",
    title: "Gas turbine prices soar 195% as market faces supply-demand crisis",
    publicationYear: 2026,
    url: "https://www.woodmac.com/press-releases/gas-turbine-prices-soar-195-as-market-faces-supply-demand-crisis/",
    sourceType: "industry-study",
  },
  {
    id: "jpmorgan_dc_financing_2026",
    organization: "J.P. Morgan",
    title: "Financing AI infrastructure and U.S. data centers",
    publicationYear: 2026,
    url: "https://www.jpmorgan.com/insights/banking/capital-markets/financing-ai-infrastructure-data-centers",
    sourceType: "industry-study",
  },
  {
    id: "ropes_gray_dc_investment_2026",
    organization: "Ropes & Gray LLP",
    title: "Data Center Investment in 2026: AI Demand, Power Constraints, and Private Equity Trends",
    publicationYear: 2026,
    url: "https://www.ropesgray.com/en/insights/viewpoints/102mvfl/data-center-investment-in-2026-ai-demand-power-constraints-and-private-equity",
    sourceType: "industry-study",
  },
  {
    id: "meta_llama3_herd_2024",
    organization: "Meta Platforms",
    title: "The Llama 3 Herd of Models",
    publicationYear: 2024,
    url: "https://arxiv.org/abs/2407.21783",
    sourceType: "operator-disclosure",
  },
  {
    id: "anasim_gpu_fit_2026",
    organization: "Anasim",
    title: "The Economics of GPU Failure in Data Centers",
    publicationYear: 2026,
    url: "https://www.anasim.com/articles/gpu-failure-economics",
    sourceType: "industry-study",
  },
] as const;

export const ASSUMPTION_PROVENANCE: readonly AssumptionProvenance[] = [
  {
    input: "real_discount_rate",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.real_discount_rate,
    unit: "real fraction",
    sourceIds: ["lazard_lcoe_2026", "jpmorgan_dc_financing_2026", "ropes_gray_dc_investment_2026"],
    useInModel: "Discounts the terrestrial annual cost/energy schedule and the CCGT power-system LCOE; independent of Panthalassa's own discount rate.",
    interpretation: "Blends 2026 investment-grade, long-term-contracted data-center project debt (mid-5% to low-7% nominal) with a typical infrastructure equity cost of capital, net of ~2.3% expected inflation. Deliberately lower than Panthalassa's own rate: mature technology plus a creditworthy contracted off-taker gets materially better financing than first-of-a-kind marine infrastructure.",
    confidence: "medium",
  },
  {
    input: "chip_failure_rate_annual",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.chip_failure_rate_annual,
    unit: "fraction per year",
    sourceIds: ["meta_llama3_herd_2024", "anasim_gpu_fit_2026"],
    useInModel: "Drives terrestrial's expected annual compute-failure replacement cost; failed capacity is assumed replaced immediately/locally, unlike Panthalassa's tug-based service schedule.",
    interpretation: "Bracketed by a theoretical FIT-rate floor of ~0.9%/year for a 10,000-GPU cluster and ~9%/year computed from Meta's Llama 3 405B training run (GPU + HBM3 memory failures over a 54-day, 16,384-H100 production run, annualized). The 9% figure is a frontier, continuous, near-100%-utilization training stress ceiling, not a typical fleet average -- 4% is a normal mixed training/inference hyperscale default between the two.",
    confidence: "medium",
  },
  {
    input: "pue",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.pue,
    unit: "ratio",
    sourceIds: ["microsoft_pue_fy2025", "uptime_survey_2025"],
    useInModel: "Converts delivered IT load into average facility electrical load.",
    interpretation: "1.20 represents a new hyperscale design, between Microsoft's 1.16 Americas result and the older/mixed global fleet average of 1.54.",
    confidence: "high",
  },
  {
    input: "power_system_availability",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.power_system_availability,
    unit: "fraction",
    sourceIds: ["mccalip_public_model", "lazard_lcoe_2026", "eia_ccgt_capacity_factor_2025"],
    useInModel: "Divides average facility load to size CCGT nameplate and sets annual LCOE generation.",
    interpretation: "A captive-baseload design assumption, not the observed U.S. merchant-fleet capacity factor. It must remain a sensitivity.",
    confidence: "medium",
  },
  {
    input: "ccgt_capex_usd_per_kw",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_capex_usd_per_kw,
    unit: "2026 USD/kW",
    sourceIds: ["sp_global_btm_2026", "woodmac_turbine_pricing_2026", "eia_aeo2025_capital", "brattle_pjm_cone_2025", "lazard_lcoe_2026"],
    useInModel: "Multiplied by availability- and PUE-adjusted CCGT nameplate; included in total cost and power-system LCOE.",
    interpretation: "Re-baselined to the current behind-the-meter market rather than generic 2025 new-build planning studies: S&P Global's dedicated data-center BTM case study puts combined-cycle capex at $2,293/kW, and Wood Mackenzie reports gas turbine prices up roughly 195% over 2019 amid a 100+ GW OEM backlog. The older EIA/Brattle/Lazard generic estimates are retained as context for the lower end of the slider range, not as the current central case.",
    confidence: "medium",
  },
  {
    input: "delivered_gas_price_usd_per_mmbtu",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.delivered_gas_price_usd_per_mmbtu,
    unit: "USD/MMBtu delivered",
    sourceIds: ["eia_delivered_gas_2025", "eia_delivered_gas_definition"],
    useInModel: "Multiplied by plant fuel consumption.",
    interpretation: "Representative U.S. plant-gate price. Because it is delivered, pipeline transport must not be added again.",
    confidence: "medium",
  },
  {
    input: "ccgt_fixed_om_usd_per_kw_year",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_fixed_om_usd_per_kw_year,
    unit: "USD/kW-year",
    sourceIds: ["eia_aeo2025_capital", "brattle_pjm_cone_2025", "lazard_lcoe_2026"],
    useInModel: "Annual recurring power-system cost on CCGT nameplate.",
    interpretation: "Physical operating/LTSA reference. It excludes property tax, insurance, financing, and separately priced gas transport for comparison-boundary symmetry.",
    confidence: "medium",
  },
  {
    input: "ccgt_economic_life_years",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.ccgt_economic_life_years,
    unit: "years",
    sourceIds: ["eia_aeo2025_capital", "brattle_pjm_cone_2025", "lazard_lcoe_2026"],
    useInModel: "Sets the standalone power-system LCOE horizon and long-horizon replacement schedule.",
    interpretation: "Consensus midpoint: Brattle uses 20 years, Lazard 30, and EIA commonly uses 40-year technical/economic assumptions.",
    confidence: "medium",
  },
  {
    input: "facility_capex_usd_per_it_watt",
    defaultValue: DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS.facility_capex_usd_per_it_watt,
    unit: "USD/installed IT W",
    sourceIds: ["mccalip_public_model", "turner_townsend_2025", "jll_outlook_2026"],
    useInModel: "Multiplied by installed IT watts; compute hardware and primary CCGT are excluded.",
    interpretation: "McCalip's total is retained because it lies inside current U.S. construction benchmarks; its weak component split is replaced by one bundled input.",
    confidence: "medium",
  },
] as const;
