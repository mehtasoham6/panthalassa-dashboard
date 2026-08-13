import type { ModelResult } from "../../model/index.js";
import { formatNumber, formatUsdCompact } from "../lib/formatters.js";
import styles from "./TotalOutputBand.module.css";

interface Props {
  result: ModelResult;
}

function formatGw(kw: number): string {
  const gw = kw / 1_000_000;
  return `${gw.toFixed(gw < 1 ? 3 : 2)} GW`;
}

export function TotalOutputBand({ result }: Props) {
  const { N_fleet, inputs, costs } = result;
  const totalKw = N_fleet * inputs.payload_rating_kw;

  return (
    <div className="card">
      <div className={styles.wrap}>
        <div className={styles.half}>
          <span className={styles.label}>Total installed output</span>
          <span className={`${styles.value} num`}>{formatGw(totalKw)}</span>
          <span className={styles.sub}>Across {formatNumber(N_fleet)} nodes at {inputs.payload_rating_kw} kW each</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.half}>
          <span className={styles.label}>Total lifecycle cost</span>
          <span className={`${styles.value} num`}>{formatUsdCompact(costs.total_node_fleet_cost_usd)}</span>
          <span className={styles.sub}>
            Undiscounted, over the analysis period. Initial fleet capital is charged in full; later planned
            replacement capital is included in proportion to the replacement generation&apos;s service life used
            within the selected analysis period.
          </span>
        </div>
      </div>
    </div>
  );
}
