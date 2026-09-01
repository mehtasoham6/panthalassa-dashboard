import { SHARED_SLIDERS } from "../../app/lib/sliderConfig.js";
import { runTerrestrialModel } from "../model/model.js";
import { DEFAULT_TERRESTRIAL_INPUTS } from "../model/defaults.js";
import type { TerrestrialModelInputs } from "../model/types.js";
import { getRelevantTerrestrialSliderGroups, TERRESTRIAL_POWER_SOURCE_OPTIONS } from "./sliderConfig.js";

/** The dashboard's default-slider terrestrial scenario, computed once at module load and reused by TerrestrialBaselineComparison. */
export const TERRESTRIAL_BASELINE_RESULT = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);

export interface ChangedTerrestrialInput {
  key: string;
  label: string;
  unit: string;
  fromDisplay: string;
  toDisplay: string;
}

/**
 * Sliders whose current value differs from the default by more than half a
 * step -- floating-point-safe -- plus a power-source change itself. Only
 * diffs sliders relevant to the CURRENT power_source (combined with the four
 * shared sliders, which also feed the ocean side, exactly mirroring how
 * ocean's own BaselineComparison already reflects shared-slider changes):
 * comparing an inactive technology's leftover slider values against the
 * baseline's own (different) technology would just be baseline-CCGT-vs-
 * currently-irrelevant-placeholder noise, not a real user-facing change.
 */
export function getChangedTerrestrialInputs(current: TerrestrialModelInputs): ChangedTerrestrialInput[] {
  const changed: ChangedTerrestrialInput[] = [];

  if (current.power_source !== DEFAULT_TERRESTRIAL_INPUTS.power_source) {
    const fromLabel = TERRESTRIAL_POWER_SOURCE_OPTIONS.find((o) => o.key === DEFAULT_TERRESTRIAL_INPUTS.power_source)?.label ?? DEFAULT_TERRESTRIAL_INPUTS.power_source;
    const toLabel = TERRESTRIAL_POWER_SOURCE_OPTIONS.find((o) => o.key === current.power_source)?.label ?? current.power_source;
    changed.push({ key: "power_source", label: "Power source", unit: "", fromDisplay: fromLabel, toDisplay: toLabel });
  }

  const relevantSliders = [...SHARED_SLIDERS, ...getRelevantTerrestrialSliderGroups(current.power_source).flatMap((g) => g.sliders)];
  for (const slider of relevantSliders) {
    const key = slider.key as keyof TerrestrialModelInputs;
    const from = DEFAULT_TERRESTRIAL_INPUTS[key] as number;
    const to = current[key] as number;
    const tolerance = Math.max(slider.step / 2, 1e-9);
    if (Math.abs(to - from) > tolerance) {
      const scale = slider.displayScale ?? 1;
      const decimals = slider.decimals ?? 1;
      changed.push({
        key,
        label: slider.label,
        unit: slider.unit,
        fromDisplay: (from * scale).toFixed(decimals),
        toDisplay: (to * scale).toFixed(decimals),
      });
    }
  }
  return changed;
}
