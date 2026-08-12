import { useState } from "react";
import type { ModelResult } from "../../model/index.js";
import { BASELINE_RESULT, getChangedInputs } from "../lib/baseline.js";
import styles from "./BaselineComparison.module.css";

interface Props {
  result: ModelResult;
}

/** Same formula already used elsewhere for "delivered output per node" -- kW instead of MW. */
function deliveredKwPerNode(r: ModelResult): number {
  return (r.expected_delivered_energy_per_position_mw_years / r.inputs.analysis_period_years) * 1000;
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

export function BaselineComparison({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const changed = getChangedInputs(result.inputs);

  if (changed.length === 0) {
    return (
      <div className={`card ${styles.collapsed}`}>
        <span className={styles.collapsedText}>Current scenario matches baseline</span>
      </div>
    );
  }

  const metrics = [
    {
      label: "Delivered / node",
      from: deliveredKwPerNode(BASELINE_RESULT),
      to: deliveredKwPerNode(result),
      higherIsBetter: true,
    },
    {
      label: "Required fleet",
      from: BASELINE_RESULT.N_fleet,
      to: result.N_fleet,
      higherIsBetter: false,
    },
    {
      label: "Lifecycle cost",
      from: BASELINE_RESULT.costs.total_node_fleet_cost_usd,
      to: result.costs.total_node_fleet_cost_usd,
      higherIsBetter: false,
    },
    {
      label: "LCOE",
      from: BASELINE_RESULT.lcoe.lcoe_usd_per_mwh,
      to: result.lcoe.lcoe_usd_per_mwh,
      higherIsBetter: false,
    },
    {
      label: "Wave resource capacity factor",
      from: BASELINE_RESULT.derived.raw_wave_resource_cf,
      to: result.derived.raw_wave_resource_cf,
      higherIsBetter: true,
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
