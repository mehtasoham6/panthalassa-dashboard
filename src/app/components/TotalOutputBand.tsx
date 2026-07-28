import type { ModelResult } from "../../model/index.js";
import { formatDataGb, formatNumber } from "../lib/formatters.js";
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
          <span className={styles.label}>Total workload data transferred</span>
          <span className={`${styles.value} num`}>{formatDataGb(costs.total_workload_data_transferred_gb)}</span>
          <span className={styles.sub}>Fleet-wide, over the analysis period</span>
        </div>
      </div>
    </div>
  );
}
