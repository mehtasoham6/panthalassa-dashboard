/**
 * Planned-generation capital cost allocation (Section 7.1 revision).
 *
 * The initial fleet (generation 1) is always charged in full for the
 * lifecycle-cost metric -- it must genuinely be acquired to launch the
 * modeled deployment, regardless of how short the analysis window is.
 * Later planned replacement generations (physical purchase schedule
 * unchanged: still begin exactly node_lifetime_years apart, see
 * fleet.ts/presentValue.ts) are attributed to the lifecycle-cost metric
 * only in proportion to how much of that generation's service life falls
 * inside the selected analysis horizon.
 *
 * This is a cost-ALLOCATION rule for the existing "Total lifecycle cost"
 * metric, not a claim that a replacement fleet can be financed or
 * physically purchased fractionally -- planned_node_purchases (fleet.ts)
 * and the physical/operational replacement schedule are unaffected and
 * always reflect the full physical purchase count. There is no terminal
 * residual value or credit anywhere in this calculation: a later
 * generation's capital cost is simply included at a fraction of its full
 * amount from the outset, at its own purchase time.
 */

/**
 * Fraction of generation g's (0-indexed; g=0 is the initial fleet) capital
 * cost attributable to the lifecycle-cost metric at the given analysis
 * horizon. Generation 0 is always 1 -- never prorated. Later generations
 * are clamped to [0, 1] by construction: 0 if the horizon ends before that
 * generation's purchase time, 1 once the full node life has elapsed within
 * the horizon.
 */
export function generationCapitalFraction(g: number, analysisPeriodYears: number, nodeLifeYears: number): number {
  if (g === 0) return 1;
  const startTimeYears = g * nodeLifeYears;
  const usedYears = Math.max(0, Math.min(analysisPeriodYears - startTimeYears, nodeLifeYears));
  return usedYears / nodeLifeYears;
}

/**
 * Sum of generationCapitalFraction across every planned generation
 * (0..nodeGenerations-1) -- the total "generation-equivalents" of capital
 * cost attributable to the lifecycle-cost metric. Equals
 * max(1, analysisPeriodYears / nodeLifeYears) when every generation's
 * capital cost is identical (always true in this model, since costs don't
 * escalate across generations); implemented generation-by-generation
 * anyway so per-generation PV timing stays correct and the calculation
 * remains robust if generation costs ever differ.
 */
export function computeGenerationCapitalEquivalents(
  nodeGenerations: number,
  analysisPeriodYears: number,
  nodeLifeYears: number,
): number {
  let total = 0;
  for (let g = 0; g < nodeGenerations; g++) {
    total += generationCapitalFraction(g, analysisPeriodYears, nodeLifeYears);
  }
  return total;
}
