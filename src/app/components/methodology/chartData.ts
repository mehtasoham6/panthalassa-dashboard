/** Fixed, explicitly illustrative chart. Does not modify or feed the economic model. */
export const COMPUTE_KW = 200;
export const PTO_KW = 300;
export const BATTERY_KWH = 100;
export const TUG_HOURS = 50 / 300 * 24;
export const TUG_END_KW = 215;
export const TRAVEL_END_KW = 537;
// Sea-park examples are three-hour-equivalent triangular lulls, not a historical trace.
export const SEA = [
  [0,537],[3,590],[6,430],[9,200],[10.5,160],[12,200],[15,537],
  [18,200],[21,80],[24,200],[27,570],[30,490],[33,610],[36,537],
] as const;
export const LULLS = [
  { start: 9, end: 12, deficit: 60 },
  { start: 18, end: 24, deficit: 360 },
] as const;
export function recoverSeaPower(time: number, resource: number): number {
  const base = Math.min(COMPUTE_KW, resource, PTO_KW);
  const lull = LULLS.find(l => time >= l.start && time <= l.end);
  if (!lull) return base;
  const duration = lull.end - lull.start;
  const elapsed = time - lull.start;
  const slope = 4 * lull.deficit / duration ** 2;
  const used = elapsed <= duration / 2
    ? slope * elapsed ** 2 / 2
    : lull.deficit - slope * (duration - elapsed) ** 2 / 2;
  // Hold full compute power until the battery is empty, then follow wave power.
  return used <= BATTERY_KWH ? COMPUTE_KW : base;
}
export function seaBatteryProfile(): [number, number][] {
  const points: [number, number][] = SEA.map(([t,p]) => [t,recoverSeaPower(t,p)]);
  for (const lull of LULLS) {
    if (lull.deficit <= BATTERY_KWH) continue;
    const duration = lull.end - lull.start;
    const slope = 4 * lull.deficit / duration ** 2;
    const elapsed = BATTERY_KWH <= lull.deficit / 2
      ? Math.sqrt(2 * BATTERY_KWH / slope)
      : duration - Math.sqrt(2 * (lull.deficit - BATTERY_KWH) / slope);
    const time = lull.start + elapsed;
    const raw = COMPUTE_KW - slope * Math.min(elapsed, duration - elapsed);
    const index = points.findIndex(([t]) => t >= time);
    // Two points at depletion show the change without inventing a gradual taper.
    points.splice(index, 0, [time,COMPUTE_KW], [time,raw]);
  }
  return points;
}
export function travelBatteryPower(fraction: number, outbound: boolean): number {
  const slope = TUG_END_KW/TUG_HOURS;
  const t = fraction*TUG_HOURS;
  const raw = outbound ? slope*t : TUG_END_KW-slope*t;
  const deficit = outbound ? COMPUTE_KW*t-slope*t*t/2 : slope*Math.max(0,t-(TUG_END_KW-COMPUTE_KW)/slope)**2/2;
  // Fully charged departure, or recharge on the ample-power inbound self-propelled leg.
  return raw >= COMPUTE_KW || deficit <= BATTERY_KWH ? COMPUTE_KW : raw;
}
