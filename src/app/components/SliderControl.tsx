import { useId, useState } from "react";
import styles from "./SliderControl.module.css";

/**
 * Deliberately not keyed to ModelInputs: shared with the terrestrial
 * sidebar, which renders the exact same shape keyed to its own inputs.
 */
export interface GenericSliderConfig {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  displayScale?: number;
  decimals?: number;
  helpText?: string;
}

interface Props {
  config: GenericSliderConfig;
  value: number;
  onChange: (value: number) => void;
}

export function SliderControl({ config, value, onChange }: Props) {
  const scale = config.displayScale ?? 1;
  const decimals = config.decimals ?? 1;
  const displayValue = value * scale;
  const isDefault = Math.abs(value - config.default) < 1e-9;
  const inputId = useId();
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <div className={styles.row}>
      <div className={styles.topLine}>
        {config.helpText ? (
          <button
            type="button"
            className={styles.labelHint}
            aria-expanded={tipOpen}
            aria-controls={tipId}
            onClick={() => setTipOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setTipOpen(false);
              }
            }}
          >
            {config.label}
            <span id={tipId} role="tooltip" className={styles.tooltip} data-open={tipOpen}>
              {config.helpText}
            </span>
          </button>
        ) : (
          <label htmlFor={inputId} className={styles.label}>
            {config.label}
          </label>
        )}
        <span className={styles.valueGroup}>
          <span className={`${styles.value} num`}>{displayValue.toFixed(decimals)}</span>
          <span className={styles.unit}>{config.unit}</span>
        </span>
      </div>
      <div className={styles.sliderTrack}>
        <input
          id={inputId}
          className={styles.slider}
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={config.label}
          aria-describedby={config.helpText ? tipId : undefined}
          aria-valuetext={`${displayValue.toFixed(decimals)} ${config.unit}`}
        />
      </div>
      <div className={styles.bottomLine}>
        <span className={`${styles.rangeLabel} num`}>
          {(config.min * scale).toFixed(decimals)}–{(config.max * scale).toFixed(decimals)} {config.unit}
        </span>
        <button
          type="button"
          className={styles.defaultTag}
          disabled={isDefault}
          onClick={() => onChange(config.default)}
        >
          default: {(config.default * scale).toFixed(decimals)}
        </button>
      </div>
    </div>
  );
}
