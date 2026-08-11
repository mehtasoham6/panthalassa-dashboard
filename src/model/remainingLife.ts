/**
 * Straight-line remaining-economic-life factor for Modes 4/5 total-loss
 * replacement cost (Section 7.2 revision). A loss near the end of a node's
 * planned generation life costs less, in expectation, than a loss early in
 * life: an early replacement substitutes for a future planned generation
 * purchase, so it isn't economically equivalent to destroying a brand-new
 * node. This is an economic-cost adjustment only -- the replacement node is
 * still physically purchased in full and deployed immediately; energy and
 * availability treatment for Modes 4/5 is unchanged.
 *
 * The model is expected-value (constant hazard rate), not a per-event
 * simulation, so these are closed-form integrals of the straight-line
 * factor rather than a stochastic asset simulator.
 */

/** remainingFraction(0) = 1, remainingFraction(nodeLifeYears) = 0, clamped to [0,1]. */
export function remainingLifeFraction(age: number, nodeLifeYears: number): number {
  if (nodeLifeYears <= 0) return 0;
  return Math.max(0, Math.min(1, (nodeLifeYears - age) / nodeLifeYears));
}

/**
 * Definite integral of remainingLifeFraction(age(t), nodeLifeYears) over
 * t in [a,b], where age(t) is time since the start of the currently active
 * planned generation -- it resets to 0 at every generation boundary
 * (t = k * nodeLifeYears for integer k >= 0), not time since the analysis
 * began. Splits the interval at any generation boundaries it spans.
 */
export function remainingLifeIntegral(a: number, b: number, nodeLifeYears: number): number {
  if (b <= a || nodeLifeYears <= 0) return 0;
  let total = 0;
  let t = a;
  while (t < b - 1e-12) {
    const gen = Math.floor(t / nodeLifeYears);
    const genEnd = (gen + 1) * nodeLifeYears;
    const segEnd = Math.min(b, genEnd);
    const ageA = t - gen * nodeLifeYears;
    const ageB = segEnd - gen * nodeLifeYears;
    // integral of (1 - age/L) over [ageA,ageB] = (ageB-ageA) - (ageB^2-ageA^2)/(2L)
    total += (ageB - ageA) - (ageB * ageB - ageA * ageA) / (2 * nodeLifeYears);
    t = segEnd;
  }
  return total;
}

/** Average remaining-life factor over [a,b] -- the integral above, divided by the interval length. */
export function averageRemainingLifeFraction(a: number, b: number, nodeLifeYears: number): number {
  if (b <= a) return 0;
  return remainingLifeIntegral(a, b, nodeLifeYears) / (b - a);
}
