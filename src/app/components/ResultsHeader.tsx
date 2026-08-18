import type { ModelResult } from "../../model/index.js";
import { formatNumber, formatPercent, formatUsdCompact } from "../lib/formatters.js";
import styles from "./ResultsHeader.module.css";

interface Props {
  result: ModelResult;
  isPending: boolean;
}

interface Tile {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
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
      label: "Wave resource capacity factor",
      value: formatPercent(result.derived.raw_wave_resource_cf, 1),
      sub: "Average output the waves provide, as a share of the node's maximum possible output.",
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
        </div>
      ))}
    </div>
  );
}
