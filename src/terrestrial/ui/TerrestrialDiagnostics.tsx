import type { TerrestrialModelResult } from "../model/types.js";
import { MODEL_CONSTANTS } from "../model/defaults.js";
import { formatNumber } from "../../app/lib/formatters.js";
import styles from "./TerrestrialPanel.module.css";

interface Props {
  result: TerrestrialModelResult;
}

/**
 * Ocean-only diagnostics have a terrestrial mirror here (standalone tile
 * cards, matching ResultsHeader's pattern) -- with no ocean counterpart:
 * the shared/paired metrics live in the banner and ArchitectureComparison.
 */
export function TerrestrialDiagnostics({ result }: Props) {
  const metrics = [
    {
      label: "Average facility electrical load",
      value: `${formatNumber(result.capacity.average_facility_electrical_load_mw / 1_000, 3)} GW`,
      detail: `Delivered compute × ${result.inputs.pue.toFixed(2)} PUE`,
    },
    {
      label: "Generation margin over load",
      value: `+${(result.capacity.generation_nameplate_margin_over_average_load * 100).toFixed(0)}%`,
      detail: "CCGT nameplate built above average load for captive-baseload availability",
    },
    {
      label: "Natural gas consumed",
      value: `${formatNumber(result.energy.analysis_period_natural_gas_bcf, 1)} Bcf`,
      detail: `${MODEL_CONSTANTS.ccgt_heat_rate_btu_per_kwh_hhv.toLocaleString()} Btu/kWh net HHV`,
    },
  ];

  return (
    <div className={styles.tileGrid}>
      {metrics.map((metric) => (
        <div key={metric.label} className={`card ${styles.tile}`}>
          <span className={styles.tileLabel}>{metric.label}</span>
          <span className={`${styles.tileValue} num`}>{metric.value}</span>
          <span className={styles.tileSub}>{metric.detail}</span>
        </div>
      ))}
    </div>
  );
}
