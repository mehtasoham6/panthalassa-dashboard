import { SHARED_SLIDERS } from "../../app/lib/sliderConfig.js";
import { runTerrestrialModel } from "../model/model.js";
import { DEFAULT_TERRESTRIAL_INPUTS } from "../model/defaults.js";
import type { TerrestrialModelInputs } from "../model/types.js";
import { ALL_TERRESTRIAL_SLIDERS } from "./sliderConfig.js";

/** The dashboard's default-slider terrestrial scenario, computed once at module load and reused by TerrestrialBaselineComparison. */
export const TERRESTRIAL_BASELINE_RESULT = runTerrestrialModel(DEFAULT_TERRESTRIAL_INPUTS);

export interface ChangedTerrestrialInput {
  key: keyof TerrestrialModelInputs;
  label: string;
  unit: string;
  fromDisplay: string;
  toDisplay: string;
}

/**
 * Combines the four shared sliders (which also feed the ocean side) with
 * terrestrial's own, so a shared-slider change shows up here too -- exactly
 * mirroring how ocean's own BaselineComparison already reflects shared-slider
 * changes (they live in the same ModelInputs object it diffs against).
 */
const ALL_TERRESTRIAL_INPUT_SLIDERS = [...SHARED_SLIDERS, ...ALL_TERRESTRIAL_SLIDERS];

/** Sliders whose current value differs from the default by more than half a step -- floating-point-safe. */
export function getChangedTerrestrialInputs(current: TerrestrialModelInputs): ChangedTerrestrialInput[] {
  const changed: ChangedTerrestrialInput[] = [];
  for (const slider of ALL_TERRESTRIAL_INPUT_SLIDERS) {
    const key = slider.key as keyof TerrestrialModelInputs;
    const from = DEFAULT_TERRESTRIAL_INPUTS[key];
    const to = current[key];
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
