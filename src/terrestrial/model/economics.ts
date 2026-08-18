/** End-of-year discounting, matching Panthalassa's convention. */
export function discount(value: number, realRate: number, year: number): number {
  return value / Math.pow(1 + realRate, year);
}

/**
 * Panthalassa-compatible capital attribution:
 * - the initial asset is charged in full at t=0;
 * - a later planned generation is charged at its purchase time only in
 *   proportion to the part of its economic life used within the horizon;
 * - no terminal residual-value credit is created.
 */
export function plannedCapitalSchedule(
  fullGenerationCapexUsd: number,
  economicLifeYears: number,
  analysisPeriodYears: number,
): number[] {
  const yearly = new Array<number>(analysisPeriodYears + 1).fill(0);
  yearly[0] = fullGenerationCapexUsd;

  for (let startYear = economicLifeYears; startYear < analysisPeriodYears; startYear += economicLifeYears) {
    const usedYears = Math.min(analysisPeriodYears - startYear, economicLifeYears);
    yearly[startYear]! += fullGenerationCapexUsd * (usedYears / economicLifeYears);
  }
  return yearly;
}

export function retirementSchedule(
  fullGenerationCapexUsd: number,
  economicLifeYears: number,
  analysisPeriodYears: number,
  decommissioningFraction: number,
): number[] {
  const yearly = new Array<number>(analysisPeriodYears + 1).fill(0);
  for (let year = economicLifeYears; year <= analysisPeriodYears; year += economicLifeYears) {
    yearly[year]! += fullGenerationCapexUsd * decommissioningFraction;
  }
  return yearly;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function addSchedules(target: number[], source: readonly number[]): void {
  if (target.length !== source.length) throw new Error("schedule lengths must match");
  for (let i = 0; i < target.length; i++) target[i]! += source[i]!;
}
