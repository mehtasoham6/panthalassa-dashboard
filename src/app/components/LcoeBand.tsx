import type { ModelResult } from "../../model/index.js";
import { formatUsdPerUnit } from "../lib/formatters.js";
import styles from "./TotalOutputBand.module.css";

interface Props {
  result: ModelResult;
}

/** Reuses TotalOutputBand's CSS module for visual consistency; sits in its own row below the total-lifecycle-cost cards. */
export function LcoeBand({ result }: Props) {
  return (
    <div className={`card ${styles.accentCard}`}>
      <div className={styles.eyebrowRow}>
        <span className={styles.eyebrow}>Panthalassa</span>
      </div>
      <div className={styles.wrap}>
        <div className={styles.half}>
          <span className={styles.label}>Power-system LCOE</span>
          <span className={`${styles.value} num`}>{formatUsdPerUnit(result.lcoe.lcoe_usd_per_mwh, 2)}/MWh</span>
          <span className={styles.sub}>Compute-agnostic, over the node's economic life.</span>
        </div>
      </div>
    </div>
  );
}
