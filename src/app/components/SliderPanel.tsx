import { SLIDER_GROUPS } from "../lib/sliderConfig.js";
import type { ModelInputs } from "../../model/index.js";
import { SliderControl } from "./SliderControl.js";
import styles from "./SliderPanel.module.css";

interface Props {
  inputs: ModelInputs;
  setInput: (key: keyof ModelInputs, value: number) => void;
  resetAll: () => void;
}

export function SliderPanel({ inputs, setInput, resetAll }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Inputs</h2>
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset to defaults
        </button>
      </div>
      <div className={`${styles.scrollArea} scroll-thin`}>
        {SLIDER_GROUPS.map((group) => (
          <details key={group.title} className={styles.group} open>
            <summary className={styles.groupSummary}>
              <span className={styles.groupTitle}>{group.title}</span>
              <svg
                className={styles.chevron}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 2.5 7.5 6 4 9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className={styles.groupBody}>
              {group.sliders.map((slider) => (
                <SliderControl
                  key={slider.key}
                  config={slider}
                  value={inputs[slider.key]}
                  onChange={(v) => setInput(slider.key, v)}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
