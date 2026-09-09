import type { ModelResult } from "../../model/index.js";
import { formatNumber, formatPercent, formatUsdCompact } from "../lib/formatters.js";
import styles from "./ResultsHeader.module.css";

interface Props {
  result: ModelResult;
  isPending: boolean;
}

interface SecondaryMetric {
  label: string;
  value: string;
  sub: string;
}

interface Tile {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
  /** Smaller, visually subordinate metrics shown inside the same card, below the primary value/sub. */
  secondary?: SecondaryMetric[];
}

/**
 * Ocean-only diagnostics with no terrestrial counterpart. The paired/shared
 * metrics (present-value cost, cost per target watt, LCOE, workload data)
 * live in ArchitectureComparison instead, so they aren't repeated here.
 */
export function ResultsHeader({ result, isPending }: Props) {
  const tiles: Tile[] = [
    {
      label: "Required operating fleet",
      value: formatNumber(result.N_fleet),
      sub: `${formatNumber(result.planned_node_purchases)} nodes purchased over ${result.node_generations} generation${result.node_generations > 1 ? "s" : ""}`,
      primary: true,
    },
    {
      label: "Per-node cost",
      value: formatUsdCompact(result.costs.physical_node_cost_usd),
      sub: "Hull, PTO, battery, onboard systems, and compute -- one node, before replacement or maintenance.",
    },
    {
      label: "Resource capacity factor",
      value: formatPercent(result.derived.resource_capacity_factor, 1),
      sub: "Useful compute work delivered relative to continuous full-power operation.",
      secondary: [
        {
          label: "Rated power availability",
          value: formatPercent(result.derived.rated_power_availability, 1),
          sub: "Time the full payload can run at 100%",
        },
        {
          label: "Keepalive availability",
          value: formatPercent(result.derived.keepalive_availability, 1),
          sub: "Time there is enough power to keep servers on",
        },
      ],
    },
  ];

  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <div key={tile.label} className={`card ${styles.tile} ${tile.primary ? styles.tilePrimary : ""}`}>
          {isPending && <span className={styles.pendingDot} aria-hidden />}
          <span className={styles.label}>{tile.label}</span>
          <span className={`${styles.value} num`}>{tile.value}</span>
          <span className={styles.sub}>{tile.sub}</span>
          {tile.secondary && (
            <div className={styles.secondaryRow}>
              {tile.secondary.map((metric) => (
                <div key={metric.label} className={styles.secondaryMetric}>
                  <span className={styles.secondaryLabel}>{metric.label}</span>
                  <span className={`${styles.secondaryValue} num`}>{metric.value}</span>
                  <span className={styles.secondarySub}>{metric.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
