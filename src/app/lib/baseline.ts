import { runModel, DEFAULT_INPUTS, type ModelInputs } from "../../model/index.js";
import { ALL_SLIDERS } from "./sliderConfig.js";

/** The dashboard's default-slider scenario, computed once at module load and reused by BaselineComparison. */
export const BASELINE_RESULT = runModel(DEFAULT_INPUTS);

export interface ChangedInput {
  key: keyof ModelInputs;
  label: string;
  unit: string;
  fromDisplay: string;
  toDisplay: string;
}

/** Sliders whose current value differs from the default by more than half a step -- floating-point-safe. */
export function getChangedInputs(current: ModelInputs): ChangedInput[] {
  const changed: ChangedInput[] = [];
  for (const slider of ALL_SLIDERS) {
    const from = DEFAULT_INPUTS[slider.key];
    const to = current[slider.key];
    const tolerance = Math.max(slider.step / 2, 1e-9);
    if (Math.abs(to - from) > tolerance) {
      const scale = slider.displayScale ?? 1;
      const decimals = slider.decimals ?? 1;
      changed.push({
        key: slider.key,
        label: slider.label,
        unit: slider.unit,
        fromDisplay: (from * scale).toFixed(decimals),
        toDisplay: (to * scale).toFixed(decimals),
      });
    }
  }
  return changed;
}
