/**
 * Journey-stage energy integration (Section 3.2-3.4).
 *
 * The representative wave-flux profile (Section 3.1, revised) is: dockside
 * 0 kW/m; tug to deep water 0 -> 40 kW/m; outbound self-propulsion
 * 40 -> 100 kW/m; sea-park operation 100 kW/m constant; return
 * self-propulsion 100 -> 40 kW/m; tug from deep water to port 40 -> 0 kW/m.
 * The self-propulsion legs ramp continuously to/from the sea-park value --
 * there is no discontinuity at the sea-park boundary (self-propulsion
 * previously topped out at 75 kW/m before jumping to the 100 kW/m sea-park
 * value; it now connects exactly).
 *
 * Full generality is kept (rather than hard-coding "self-propulsion legs are
 * always capped") because at the extremes of the slider ranges (small hull,
 * large payload) full_output_flux_kw_per_m can exceed 100 kW/m, which would
 * put every leg below cap or crossing it. The spec's split-integration
 * formula is written for a flux ramp that *increases* through the cap
 * (the outbound tug leg); the return tug leg *decreases* through the cap,
 * so the capped/ramping segments swap order. Both are handled generally
 * below via direct integration of the same linear-ramp-with-cap physics.
 */

export const WAVE_FLUX = {
  dock: 0,
  deepWaterTransfer: 40,
  seaPark: 100,
} as const;

interface CapParams {
  capture_coefficient: number;
  power_cap_kw: number;
  full_output_flux_kw_per_m: number;
}

export function constantLegEnergyKwh(
  fluxKwPerM: number,
  durationDays: number,
  { capture_coefficient, power_cap_kw }: CapParams,
): number {
  if (durationDays <= 0) return 0;
  const power_kw = Math.min(power_cap_kw, capture_coefficient * fluxKwPerM);
  return power_kw * durationDays * 24;
}

export function rampLegEnergyKwh(
  fluxStart: number,
  fluxEnd: number,
  durationDays: number,
  { capture_coefficient, power_cap_kw, full_output_flux_kw_per_m }: CapParams,
): number {
  if (durationDays <= 0) return 0;
  const lo = Math.min(fluxStart, fluxEnd);
  const hi = Math.max(fluxStart, fluxEnd);

  if (lo >= full_output_flux_kw_per_m) {
    // Entire leg at or above the full-output threshold: constant cap.
    return power_cap_kw * durationDays * 24;
  }
  if (hi <= full_output_flux_kw_per_m) {
    // Entire leg below the full-output threshold: pure ramp average.
    return 24 * capture_coefficient * durationDays * ((fluxStart + fluxEnd) / 2);
  }
  if (fluxStart === fluxEnd) {
    // Degenerate (shouldn't hit lo>=full or hi<=full above only if NaN guard needed)
    return constantLegEnergyKwh(fluxStart, durationDays, {
      capture_coefficient,
      power_cap_kw,
      full_output_flux_kw_per_m,
    });
  }

  // The ramp crosses full_output_flux_kw_per_m at time-fraction `a` of the leg.
  const a = (full_output_flux_kw_per_m - fluxStart) / (fluxEnd - fluxStart);
  const beforeCrossingDays = a * durationDays;
  const afterCrossingDays = durationDays - beforeCrossingDays;

  if (fluxStart < full_output_flux_kw_per_m) {
    // Ramping up through the cap: below-cap segment first, capped segment second.
    return 24 * (
      capture_coefficient * beforeCrossingDays * ((fluxStart + full_output_flux_kw_per_m) / 2)
      + power_cap_kw * afterCrossingDays
    );
  }
  // Ramping down through the cap: capped segment first, below-cap segment second.
  return 24 * (
    power_cap_kw * beforeCrossingDays
    + capture_coefficient * afterCrossingDays * ((full_output_flux_kw_per_m + fluxEnd) / 2)
  );
}

interface OutboundLegInputs extends CapParams {
  one_way_tug_days: number;
  one_way_self_propulsion_days: number;
}

/** Tug (0 -> 40 kW/m) then self-propulsion (40 -> 100 kW/m) — the standard outbound leg. */
export function computeOutboundLegEnergyKwh(inputs: OutboundLegInputs): number {
  const tugEnergy = rampLegEnergyKwh(
    WAVE_FLUX.dock,
    WAVE_FLUX.deepWaterTransfer,
    inputs.one_way_tug_days,
    inputs,
  );
  const selfPropEnergy = rampLegEnergyKwh(
    WAVE_FLUX.deepWaterTransfer,
    WAVE_FLUX.seaPark,
    inputs.one_way_self_propulsion_days,
    inputs,
  );
  return tugEnergy + selfPropEnergy;
}

/** Self-propulsion (100 -> 40 kW/m) then tug (40 -> 0 kW/m) — the standard return leg. */
export function computeReturnLegEnergyKwh(inputs: OutboundLegInputs): number {
  const selfPropEnergy = rampLegEnergyKwh(
    WAVE_FLUX.seaPark,
    WAVE_FLUX.deepWaterTransfer,
    inputs.one_way_self_propulsion_days,
    inputs,
  );
  const tugEnergy = rampLegEnergyKwh(
    WAVE_FLUX.deepWaterTransfer,
    WAVE_FLUX.dock,
    inputs.one_way_tug_days,
    inputs,
  );
  return selfPropEnergy + tugEnergy;
}

export function seaParkLegEnergyKwh(durationDays: number, params: CapParams): number {
  return constantLegEnergyKwh(WAVE_FLUX.seaPark, durationDays, params);
}

/** Energy for the first `uptoDays` of a `fullDurationDays` linear flux ramp. */
function partialRampLegEnergyKwh(
  fluxStart: number,
  fluxEnd: number,
  fullDurationDays: number,
  uptoDays: number,
  params: CapParams,
): number {
  const days = Math.max(0, Math.min(uptoDays, fullDurationDays));
  if (days <= 0 || fullDurationDays <= 0) return 0;
  const fluxAtCutoff = fluxStart + (fluxEnd - fluxStart) * (days / fullDurationDays);
  return rampLegEnergyKwh(fluxStart, fluxAtCutoff, days, params);
}

/**
 * Energy for the first `budgetDays` of a standard outbound leg (tug then
 * self-propulsion). Used to truncate a redeployment that would otherwise
 * run past the analysis horizon.
 */
export function computeOutboundLegEnergyKwhPartial(
  inputs: OutboundLegInputs,
  budgetDays: number,
): number {
  if (budgetDays <= 0) return 0;
  const fullDays = inputs.one_way_tug_days + inputs.one_way_self_propulsion_days;
  if (budgetDays >= fullDays) return computeOutboundLegEnergyKwh(inputs);

  if (budgetDays <= inputs.one_way_tug_days) {
    return partialRampLegEnergyKwh(
      WAVE_FLUX.dock,
      WAVE_FLUX.deepWaterTransfer,
      inputs.one_way_tug_days,
      budgetDays,
      inputs,
    );
  }
  const tugEnergy = rampLegEnergyKwh(
    WAVE_FLUX.dock,
    WAVE_FLUX.deepWaterTransfer,
    inputs.one_way_tug_days,
    inputs,
  );
  const selfPropBudget = budgetDays - inputs.one_way_tug_days;
  const selfPropEnergy = partialRampLegEnergyKwh(
    WAVE_FLUX.deepWaterTransfer,
    WAVE_FLUX.seaPark,
    inputs.one_way_self_propulsion_days,
    selfPropBudget,
    inputs,
  );
  return tugEnergy + selfPropEnergy;
}

/**
 * Energy for the first `budgetDays` of a standard return leg (self-propulsion
 * 100 -> 40 kW/m, then tug 40 -> 0 kW/m).
 */
export function computeReturnLegEnergyKwhPartial(
  inputs: OutboundLegInputs,
  budgetDays: number,
): number {
  if (budgetDays <= 0) return 0;
  const fullDays = inputs.one_way_self_propulsion_days + inputs.one_way_tug_days;
  if (budgetDays >= fullDays) return computeReturnLegEnergyKwh(inputs);

  if (budgetDays <= inputs.one_way_self_propulsion_days) {
    return partialRampLegEnergyKwh(
      WAVE_FLUX.seaPark,
      WAVE_FLUX.deepWaterTransfer,
      inputs.one_way_self_propulsion_days,
      budgetDays,
      inputs,
    );
  }
  const selfPropEnergy = rampLegEnergyKwh(
    WAVE_FLUX.seaPark,
    WAVE_FLUX.deepWaterTransfer,
    inputs.one_way_self_propulsion_days,
    inputs,
  );
  const tugBudget = budgetDays - inputs.one_way_self_propulsion_days;
  const tugEnergy = partialRampLegEnergyKwh(
    WAVE_FLUX.deepWaterTransfer,
    WAVE_FLUX.dock,
    inputs.one_way_tug_days,
    tugBudget,
    inputs,
  );
  return selfPropEnergy + tugEnergy;
}

/**
 * Wave-resource-vs-equipment-cap segmentation, used for battery-assisted
 * delivery and (in chipFailures.ts) for comparing available electrical power
 * against decaying compute health. Each leg is split into chronologically
 * ordered segments: "gap" segments are resource-limited (the node already
 * captures everything the wave state offers, nothing is being turned away);
 * "atcap" segments are equipment-limited (the wave resource exceeds the
 * payload/PTO cap, and the excess above it -- `potentialKwh` -- would
 * otherwise be wasted). Order matters because a battery can only discharge
 * what it previously charged, in chronological sequence.
 */
export interface LegSegment {
  kind: "gap" | "atcap";
  days: number;
  /** Energy delivered under the pre-battery capped model. */
  deliveredEnergyKwh: number;
  /** "atcap": surplus available to charge a battery. "gap": shortfall a battery could fill. Always >= 0. */
  potentialKwh: number;
}

function constantLegSegments(fluxKwPerM: number, durationDays: number, params: CapParams): LegSegment[] {
  if (durationDays <= 0) return [];
  const { capture_coefficient, power_cap_kw, full_output_flux_kw_per_m } = params;
  const waveEnergyKwh = 24 * capture_coefficient * durationDays * fluxKwPerM;
  const cappedEnergyKwh = 24 * power_cap_kw * durationDays;
  if (fluxKwPerM <= full_output_flux_kw_per_m) {
    return [{ kind: "gap", days: durationDays, deliveredEnergyKwh: waveEnergyKwh, potentialKwh: cappedEnergyKwh - waveEnergyKwh }];
  }
  return [{ kind: "atcap", days: durationDays, deliveredEnergyKwh: cappedEnergyKwh, potentialKwh: waveEnergyKwh - cappedEnergyKwh }];
}

function rampLegSegments(fluxStart: number, fluxEnd: number, durationDays: number, params: CapParams): LegSegment[] {
  if (durationDays <= 0) return [];
  const { capture_coefficient, power_cap_kw, full_output_flux_kw_per_m } = params;
  const lo = Math.min(fluxStart, fluxEnd);
  const hi = Math.max(fluxStart, fluxEnd);

  if (hi <= full_output_flux_kw_per_m) {
    const deliveredEnergyKwh = 24 * capture_coefficient * durationDays * ((fluxStart + fluxEnd) / 2);
    const cappedEnergyKwh = 24 * power_cap_kw * durationDays;
    return [{ kind: "gap", days: durationDays, deliveredEnergyKwh, potentialKwh: cappedEnergyKwh - deliveredEnergyKwh }];
  }
  if (lo >= full_output_flux_kw_per_m) {
    const deliveredEnergyKwh = 24 * power_cap_kw * durationDays;
    const waveEnergyKwh = 24 * capture_coefficient * durationDays * ((fluxStart + fluxEnd) / 2);
    return [{ kind: "atcap", days: durationDays, deliveredEnergyKwh, potentialKwh: waveEnergyKwh - deliveredEnergyKwh }];
  }
  if (fluxStart === fluxEnd) return [];

  const a = (full_output_flux_kw_per_m - fluxStart) / (fluxEnd - fluxStart);
  const beforeCrossingDays = a * durationDays;
  const afterCrossingDays = durationDays - beforeCrossingDays;

  if (fluxStart < full_output_flux_kw_per_m) {
    // Ramping up: gap segment first (fluxStart..threshold), atcap segment second (threshold..fluxEnd).
    const gapDeliveredKwh = 24 * capture_coefficient * beforeCrossingDays * ((fluxStart + full_output_flux_kw_per_m) / 2);
    const gapCappedKwh = 24 * power_cap_kw * beforeCrossingDays;
    const atcapDeliveredKwh = 24 * power_cap_kw * afterCrossingDays;
    const atcapWaveKwh = 24 * capture_coefficient * afterCrossingDays * ((full_output_flux_kw_per_m + fluxEnd) / 2);
    return [
      { kind: "gap", days: beforeCrossingDays, deliveredEnergyKwh: gapDeliveredKwh, potentialKwh: gapCappedKwh - gapDeliveredKwh },
      { kind: "atcap", days: afterCrossingDays, deliveredEnergyKwh: atcapDeliveredKwh, potentialKwh: atcapWaveKwh - atcapDeliveredKwh },
    ];
  }
  // Ramping down: atcap segment first (fluxStart..threshold), gap segment second (threshold..fluxEnd).
  const atcapDeliveredKwh = 24 * power_cap_kw * beforeCrossingDays;
  const atcapWaveKwh = 24 * capture_coefficient * beforeCrossingDays * ((fluxStart + full_output_flux_kw_per_m) / 2);
  const gapDeliveredKwh = 24 * capture_coefficient * afterCrossingDays * ((full_output_flux_kw_per_m + fluxEnd) / 2);
  const gapCappedKwh = 24 * power_cap_kw * afterCrossingDays;
  return [
    { kind: "atcap", days: beforeCrossingDays, deliveredEnergyKwh: atcapDeliveredKwh, potentialKwh: atcapWaveKwh - atcapDeliveredKwh },
    { kind: "gap", days: afterCrossingDays, deliveredEnergyKwh: gapDeliveredKwh, potentialKwh: gapCappedKwh - gapDeliveredKwh },
  ];
}

/** Chronologically ordered segments for a standard outbound leg (tug then self-propulsion). */
export function outboundLegSegments(inputs: OutboundLegInputs): LegSegment[] {
  return [
    ...rampLegSegments(WAVE_FLUX.dock, WAVE_FLUX.deepWaterTransfer, inputs.one_way_tug_days, inputs),
    ...rampLegSegments(WAVE_FLUX.deepWaterTransfer, WAVE_FLUX.seaPark, inputs.one_way_self_propulsion_days, inputs),
  ];
}

/** Chronologically ordered segments for a standard return leg (self-propulsion then tug). */
export function returnLegSegments(inputs: OutboundLegInputs): LegSegment[] {
  return [
    ...rampLegSegments(WAVE_FLUX.seaPark, WAVE_FLUX.deepWaterTransfer, inputs.one_way_self_propulsion_days, inputs),
    ...rampLegSegments(WAVE_FLUX.deepWaterTransfer, WAVE_FLUX.dock, inputs.one_way_tug_days, inputs),
  ];
}

export function seaParkLegSegments(durationDays: number, params: CapParams): LegSegment[] {
  return constantLegSegments(WAVE_FLUX.seaPark, durationDays, params);
}

function partialRampLegSegments(
  fluxStart: number,
  fluxEnd: number,
  fullDurationDays: number,
  uptoDays: number,
  params: CapParams,
): LegSegment[] {
  const days = Math.max(0, Math.min(uptoDays, fullDurationDays));
  if (days <= 0 || fullDurationDays <= 0) return [];
  const fluxAtCutoff = fluxStart + (fluxEnd - fluxStart) * (days / fullDurationDays);
  return rampLegSegments(fluxStart, fluxAtCutoff, days, params);
}

/**
 * Segments for the first `budgetDays` of a standard outbound leg. Used for
 * the rare analysis-horizon-truncation edge case in chipFailures.ts.
 */
export function outboundLegSegmentsPartial(inputs: OutboundLegInputs, budgetDays: number): LegSegment[] {
  if (budgetDays <= 0) return [];
  const fullDays = inputs.one_way_tug_days + inputs.one_way_self_propulsion_days;
  if (budgetDays >= fullDays) return outboundLegSegments(inputs);

  if (budgetDays <= inputs.one_way_tug_days) {
    return partialRampLegSegments(WAVE_FLUX.dock, WAVE_FLUX.deepWaterTransfer, inputs.one_way_tug_days, budgetDays, inputs);
  }
  const tugSegments = rampLegSegments(WAVE_FLUX.dock, WAVE_FLUX.deepWaterTransfer, inputs.one_way_tug_days, inputs);
  const selfPropBudget = budgetDays - inputs.one_way_tug_days;
  const selfPropSegments = partialRampLegSegments(
    WAVE_FLUX.deepWaterTransfer,
    WAVE_FLUX.seaPark,
    inputs.one_way_self_propulsion_days,
    selfPropBudget,
    inputs,
  );
  return [...tugSegments, ...selfPropSegments];
}

/**
 * Battery state of charge, carried across the entire schedule walk in
 * chipFailures.ts: charges from surplus during "atcap" segments (up to
 * capacity), discharges to fill shortfalls during "gap" segments (up to
 * what's stored). Assumed lossless (no round-trip efficiency modeled).
 * Charge/discharge decisions are made against the fixed equipment cap,
 * unaffected by compute health -- chipFailures.ts applies the compute-health
 * cap as a separate, subsequent constraint on top of what this produces.
 */
export interface BatteryState {
  socKwh: number;
}

export interface SegmentTotals {
  deliveredEnergyKwh: number;
  atCapDays: number;
  grossSurplusKwh: number;
  batteryChargedKwh: number;
  batteryDischargedKwh: number;
}

export function processSegments(segments: LegSegment[], battery: BatteryState, batteryCapacityKwh: number): SegmentTotals {
  let deliveredEnergyKwh = 0;
  let atCapDays = 0;
  let grossSurplusKwh = 0;
  let batteryChargedKwh = 0;
  let batteryDischargedKwh = 0;

  for (const seg of segments) {
    if (seg.kind === "atcap") {
      atCapDays += seg.days;
      grossSurplusKwh += seg.potentialKwh;
      const charge = Math.min(seg.potentialKwh, batteryCapacityKwh - battery.socKwh);
      battery.socKwh += charge;
      batteryChargedKwh += charge;
      deliveredEnergyKwh += seg.deliveredEnergyKwh;
    } else {
      const discharge = Math.min(seg.potentialKwh, battery.socKwh);
      battery.socKwh -= discharge;
      batteryDischargedKwh += discharge;
      deliveredEnergyKwh += seg.deliveredEnergyKwh + discharge;
    }
  }

  return { deliveredEnergyKwh, atCapDays, grossSurplusKwh, batteryChargedKwh, batteryDischargedKwh };
}
