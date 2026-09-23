import { CONST } from "./constants.js";
import type { LegSegment } from "./energy.js";

/** Descriptive resource measures along the same scheduled route as node output.
 * Chip health and unexpected whole-node incidents remain outside these measures.
 */
export interface JourneyResourceTotals {
  travelHours: number;
  seaParkHours: number;
  dockHours: number;
  usefulEquivalentHours: number;
  ratedHours: number;
  keepaliveHours: number;
  ratedBatteryKwh: number;
  keepaliveBatteryKwh: number;
}

export function makeJourneyResourceTotals(batteryKwh: number): JourneyResourceTotals {
  return {
    travelHours: 0, seaParkHours: 0, dockHours: 0,
    usefulEquivalentHours: 0, ratedHours: 0, keepaliveHours: 0,
    ratedBatteryKwh: batteryKwh, keepaliveBatteryKwh: batteryKwh,
  };
}

export function resetJourneyResourceBattery(totals: JourneyResourceTotals, batteryKwh: number): void {
  totals.ratedBatteryKwh = batteryKwh;
  totals.keepaliveBatteryKwh = batteryKwh;
}

/** Mean positive value of a linearly varying quantity over a segment. */
function meanPositive(start: number, end: number): number {
  if (start >= 0 && end >= 0) return (start + end) / 2;
  if (start <= 0 && end <= 0) return 0;
  if (start < 0) return end * end / (2 * (end - start));
  return start * start / (2 * (start - end));
}

/** Portion of a linear segment strictly below a power threshold. */
function fractionBelow(start: number, end: number, threshold: number): number {
  if (start >= threshold && end >= threshold) return 0;
  if (start < threshold && end < threshold) return 1;
  return Math.abs(threshold - (start < threshold ? start : end)) / Math.abs(end - start);
}

export function creditJourneyTravel(
  totals: JourneyResourceTotals,
  segments: LegSegment[],
  captureCoefficient: number,
  ratedKw: number,
  batteryCapacityKwh: number,
  budgetHours = Infinity,
): void {
  const idleKw = ratedKw * CONST.server_idle_power_fraction;
  for (const segment of segments) {
    const fullHours = segment.days * 24;
    const hours = Math.max(0, Math.min(fullHours, budgetHours));
    if (hours === 0) break;
    budgetHours -= hours;
    totals.travelHours += hours;
    const waveStart = segment.fluxStartKwPerM * captureCoefficient;
    const waveEnd = (segment.fluxStartKwPerM +
      (segment.fluxEndKwPerM - segment.fluxStartKwPerM) * (hours / fullHours)) * captureCoefficient;
    if (segment.kind === "atcap") {
      totals.usefulEquivalentHours += hours;
      totals.ratedHours += hours;
      totals.keepaliveHours += hours;
      const surplus = hours * Math.max(0, (waveStart + waveEnd) / 2 - ratedKw);
      totals.ratedBatteryKwh = Math.min(batteryCapacityKwh, totals.ratedBatteryKwh + surplus);
      totals.keepaliveBatteryKwh = Math.min(batteryCapacityKwh, totals.keepaliveBatteryKwh + surplus);
      continue;
    }

    // Same segment-level battery allocation used by the historical sea-park
    // availability diagnostics: recover an equivalent fraction of the gap's
    // hours, with partial power counted toward useful-work capacity factor.
    const deficit = hours * Math.max(0, ratedKw - (waveStart + waveEnd) / 2);
    const recovered = Math.min(deficit, totals.ratedBatteryKwh);
    const q = deficit > 0 ? recovered / deficit : 1;
    totals.ratedBatteryKwh -= recovered;
    totals.ratedHours += q * hours;

    const effectiveStart = waveStart + q * (ratedKw - waveStart);
    const effectiveEnd = waveEnd + q * (ratedKw - waveEnd);
    totals.usefulEquivalentHours += hours * meanPositive(effectiveStart - idleKw, effectiveEnd - idleKw) / (ratedKw - idleKw);

    // Keepalive asks a separate question: preserve battery energy until waves
    // fall below idle draw, as the sea-park keepalive diagnostic already does.
    const idleDeficit = hours * meanPositive(idleKw - waveStart, idleKw - waveEnd);
    const idleRecovered = Math.min(idleDeficit, totals.keepaliveBatteryKwh);
    totals.keepaliveBatteryKwh -= idleRecovered;
    const qIdle = idleDeficit > 0 ? idleRecovered / idleDeficit : 1;
    totals.keepaliveHours += hours * (1 - (1 - qIdle) * fractionBelow(waveStart, waveEnd, idleKw));
  }
}

export function journeyResourceMetrics(
  totals: JourneyResourceTotals,
  seaPark: { resource_capacity_factor: number; rated_power_availability: number; keepalive_availability: number },
): { resource_capacity_factor: number; rated_power_availability: number; keepalive_availability: number } {
  const totalHours = totals.travelHours + totals.seaParkHours + totals.dockHours;
  if (totalHours <= 0) return seaPark;
  const fraction = (seaMetric: number, travelEquivalentHours: number) =>
    Math.max(0, Math.min(1, (seaMetric * totals.seaParkHours + travelEquivalentHours) / totalHours));
  return {
    resource_capacity_factor: fraction(seaPark.resource_capacity_factor, totals.usefulEquivalentHours),
    rated_power_availability: fraction(seaPark.rated_power_availability, totals.ratedHours),
    keepalive_availability: fraction(seaPark.keepalive_availability, totals.keepaliveHours),
  };
}
