import { SLIDER_GROUPS } from "../lib/sliderConfig.js";
import type { ModelInputs } from "../../model/index.js";
import { SliderControl } from "./SliderControl.js";
import styles from "./SliderPanel.module.css";

interface Props {
  inputs: ModelInputs;
  setInput: (key: keyof ModelInputs, value: number) => void;
  resetAll: () => void;
  collapsible?: boolean;
}

export function SliderPanel({ inputs, setInput, resetAll, collapsible = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  return (
    <div className={styles.panel} data-collapsed={collapsible && !expanded}>
      <div className={styles.header}>
        {collapsible ? <button type="button" className={styles.panelToggle} aria-expanded={expanded} aria-controls={controlsId} onClick={() => setExpanded(!expanded)}>
          Panthalassa Inputs <span aria-hidden>{expanded ? '−' : '+'}</span>
        </button> : <span className={styles.headerTitle}>Panthalassa Inputs</span>}
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          Reset to defaults
        </button>
      </div>
      <div id={controlsId} hidden={collapsible && !expanded} className={`${styles.scrollArea} scroll-thin`}>
        {SLIDER_GROUPS.map((group) => (
          <details key={group.title} className={styles.group} open>
            <summary className={styles.groupSummary}>
              <span className={styles.groupTitle}>{group.title}</span>
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
import { useId, useState } from "react";
