import type { CSSProperties } from "react";
import {
  TERRESTRIAL_ALWAYS_VISIBLE_SLIDER_GROUPS,
  TERRESTRIAL_POWER_SOURCE_OPTIONS,
  POWER_SOURCE_SLIDER_GROUPS,
} from "../integration/sliderConfig.js";
import type { TerrestrialArchitectureInputs, TerrestrialPowerSource } from "../model/types.js";
import { SliderControl } from "../../app/components/SliderControl.js";
import panelStyles from "../../app/components/SliderPanel.module.css";
import styles from "./TerrestrialPanel.module.css";

interface Props {
  inputs: TerrestrialArchitectureInputs;
  onChange: (key: keyof TerrestrialArchitectureInputs, value: number) => void;
  onSelectPowerSource: (source: TerrestrialPowerSource) => void;
  onReset: () => void;
}

/** Mirrors SliderPanel.tsx's markup/styling exactly (same CSS module) so the two sidebars read as a matched pair. */
export function TerrestrialControls({ inputs, onChange, onSelectPowerSource, onReset }: Props) {
  const activeGroup = POWER_SOURCE_SLIDER_GROUPS[inputs.power_source];
  const groups = [...TERRESTRIAL_ALWAYS_VISIBLE_SLIDER_GROUPS, activeGroup];

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.header}>
        <span className={panelStyles.headerTitle}>Land-based Inputs</span>
        <button type="button" className={panelStyles.resetBtn} onClick={onReset}>
          Reset to defaults
        </button>
      </div>
      <div className={`${panelStyles.scrollArea} scroll-thin`}>
        <div className={styles.powerSourceRow}>
          <span className={styles.powerSourceLabel}>Power source</span>
          <div className={styles.powerSourceButtons}>
            {TERRESTRIAL_POWER_SOURCE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={styles.powerSourceButton}
                data-active={inputs.power_source === option.key}
                style={{ "--power-source-color": option.color } as CSSProperties}
                onClick={() => onSelectPowerSource(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {groups.map((group) => (
          <details key={group.title} className={panelStyles.group} open>
            <summary className={panelStyles.groupSummary}>
              <span className={panelStyles.groupTitle}>{group.title}</span>
              <span className={panelStyles.chevron} aria-hidden>
                &#9656;
              </span>
            </summary>
            <div className={panelStyles.groupBody}>
              {group.sliders.map((slider) => (
                <SliderControl
                  key={slider.key}
                  config={slider}
                  value={inputs[slider.key] as number}
                  onChange={(v) => onChange(slider.key, v)}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
