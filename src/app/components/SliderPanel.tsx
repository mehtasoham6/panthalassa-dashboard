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
        <span className={styles.headerTitle}>Inputs</span>
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset to defaults
        </button>
      </div>
      <div className={`${styles.scrollArea} scroll-thin`}>
        {SLIDER_GROUPS.map((group) => (
          <details key={group.title} className={styles.group} open>
            <summary className={styles.groupSummary}>
              <span className={styles.groupTitleBlock}>
                <span className={styles.groupTitle}>{group.title}</span>
                <span className={styles.groupDescription}>{group.description}</span>
              </span>
              <span className={styles.chevron} aria-hidden>
                &#9656;
              </span>
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
