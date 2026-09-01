import type { ModelResult } from "../../model/index.js";
import { formatUsdCompact } from "../lib/formatters.js";
import styles from "./TotalOutputBand.module.css";

interface Props {
  result: ModelResult;
}

export function TotalOutputBand({ result }: Props) {
  const { costs } = result;

  return (
    <div className={`card ${styles.accentCard}`}>
      <div className={styles.eyebrowRow}>
        <span className={styles.eyebrow}>Panthalassa</span>
      </div>
      <div className={styles.wrap}>
        <div className={styles.half}>
          <span className={styles.label}>Total lifecycle cost</span>
          <span className={`${styles.value} num`}>{formatUsdCompact(costs.total_node_fleet_cost_usd)}</span>
          <span className={styles.sub}>Undiscounted, over the analysis period.</span>
        </div>
      </div>
    </div>
  );
}
