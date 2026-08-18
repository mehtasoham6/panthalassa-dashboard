import type { ModelInputs } from "../../model/index.js";
import { SHARED_SLIDERS } from "../lib/sliderConfig.js";
import { SliderControl } from "./SliderControl.js";
import styles from "./SharedInputsPanel.module.css";

interface Props {
  inputs: ModelInputs;
  setInput: (key: keyof ModelInputs, value: number) => void;
}

/** The four inputs that drive both architectures identically -- lives between the two sidebars, owned by neither. */
export function SharedInputsPanel({ inputs, setInput }: Props) {
  return (
    <div className="card">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Shared</span>
        <span className={styles.title}>Inputs common to both architectures</span>
      </div>
      <div className={styles.grid}>
        {SHARED_SLIDERS.map((slider) => (
          <SliderControl
            key={slider.key}
            config={slider}
            value={inputs[slider.key]}
            onChange={(v) => setInput(slider.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
