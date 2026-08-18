import { TERRESTRIAL_SLIDER_GROUPS } from "../integration/sliderConfig.js";
import type { TerrestrialArchitectureInputs } from "../model/types.js";
import { SliderControl } from "../../app/components/SliderControl.js";
import panelStyles from "../../app/components/SliderPanel.module.css";

interface Props {
  inputs: TerrestrialArchitectureInputs;
  onChange: (key: keyof TerrestrialArchitectureInputs, value: number) => void;
  onReset: () => void;
}

/** Mirrors SliderPanel.tsx's markup/styling exactly (same CSS module) so the two sidebars read as a matched pair. */
export function TerrestrialControls({ inputs, onChange, onReset }: Props) {
  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.header}>
        <span className={panelStyles.headerTitle}>Terrestrial inputs</span>
        <button type="button" className={panelStyles.resetBtn} onClick={onReset}>
          Reset to defaults
        </button>
      </div>
      <div className={`${panelStyles.scrollArea} scroll-thin`}>
        {TERRESTRIAL_SLIDER_GROUPS.map((group) => (
          <details key={group.title} className={panelStyles.group} open>
            <summary className={panelStyles.groupSummary}>
              <span className={panelStyles.groupTitleBlock}>
                <span className={panelStyles.groupTitle}>{group.title}</span>
                <span className={panelStyles.groupDescription}>{group.description}</span>
              </span>
              <span className={panelStyles.chevron} aria-hidden>
                &#9656;
              </span>
            </summary>
            <div className={panelStyles.groupBody}>
              {group.sliders.map((slider) => (
                <SliderControl
                  key={slider.key}
                  config={slider}
                  value={inputs[slider.key]}
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
