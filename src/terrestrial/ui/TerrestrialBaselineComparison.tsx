import { useState } from "react";
import type { TerrestrialModelResult } from "../model/types.js";
import { TERRESTRIAL_BASELINE_RESULT, getChangedTerrestrialInputs } from "../integration/baseline.js";
import styles from "../../app/components/BaselineComparison.module.css";

interface Props {
  result: TerrestrialModelResult;
}

function signedPct(from: number, to: number): string {
  const pct = ((to - from) / from) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "±";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function deltaClass(from: number, to: number, higherIsBetter: boolean): string {
  if (to === from) return "";
  const improved = higherIsBetter ? to > from : to < from;
  return (improved ? styles.better : styles.worse) ?? "";
}

const VISIBLE_CHANGES = 3;

/** Mirrors BaselineComparison.tsx exactly (same CSS module) so the two "changed from baseline" cards read as a matched pair. */
export function TerrestrialBaselineComparison({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const changed = getChangedTerrestrialInputs(result.inputs);

  if (changed.length === 0) {
    return (
      <div className={`card ${styles.collapsed}`}>
        <span className={styles.collapsedText}>Current scenario matches baseline</span>
      </div>
    );
  }

  const metrics = [
    {
      label: "CCGT nameplate",
      from: TERRESTRIAL_BASELINE_RESULT.capacity.ccgt_nameplate_capacity_mw,
      to: result.capacity.ccgt_nameplate_capacity_mw,
      higherIsBetter: false,
    },
    {
      label: "Lifecycle cost",
      from: TERRESTRIAL_BASELINE_RESULT.costs.total_lifecycle_cost_usd,
      to: result.costs.total_lifecycle_cost_usd,
      higherIsBetter: false,
    },
    {
      label: "Present-value cost",
      from: TERRESTRIAL_BASELINE_RESULT.presentValue.present_value_total_lifecycle_cost_usd,
      to: result.presentValue.present_value_total_lifecycle_cost_usd,
      higherIsBetter: false,
    },
    {
      label: "LCOE",
      from: TERRESTRIAL_BASELINE_RESULT.lcoe.lcoe_usd_per_mwh,
      to: result.lcoe.lcoe_usd_per_mwh,
      higherIsBetter: false,
    },
    {
      label: "Natural gas consumed",
      from: TERRESTRIAL_BASELINE_RESULT.energy.analysis_period_natural_gas_bcf,
      to: result.energy.analysis_period_natural_gas_bcf,
      higherIsBetter: false,
    },
  ];

  const shown = expanded ? changed : changed.slice(0, VISIBLE_CHANGES);
  const remaining = changed.length - VISIBLE_CHANGES;

  return (
    <div className="card">
      <div className={styles.wrap}>
        <span className={styles.title}>Baseline vs. current</span>

        <div className={styles.metricRow}>
          {metrics.map((m) => (
            <div className={styles.metric} key={m.label}>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={`${styles.metricPct} num ${deltaClass(m.from, m.to, m.higherIsBetter)}`}>
                {signedPct(m.from, m.to)}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.changedLine}>
          <span className={styles.changedLabel}>Changed:</span>{" "}
          {shown.map((c, i) => (
            <span key={c.key}>
              {i > 0 && " · "}
              {c.label} {c.fromDisplay} → {c.toDisplay} {c.unit}
            </span>
          ))}
          {!expanded && remaining > 0 && (
            <button type="button" className={styles.moreButton} onClick={() => setExpanded(true)}>
              +{remaining} more
            </button>
          )}
          {expanded && changed.length > VISIBLE_CHANGES && (
            <button type="button" className={styles.moreButton} onClick={() => setExpanded(false)}>
              show less
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
