import type { ModelResult } from "../../model/index.js";
import { formatDataGb, formatNumber, formatPercent, formatUsdCompact, formatUsdPerUnit } from "../lib/formatters.js";
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

export function ResultsHeader({ result, isPending }: Props) {
  // Total installed output and total lifecycle cost are shown on the top
  // banner, and delivered output per node is shown on the capacity-flow
  // diagram above -- not duplicated here.
  const tiles: Tile[] = [
    {
      label: "Present-value cost",
      value: formatUsdCompact(result.presentValue.present_value_total_node_fleet_cost_usd),
      sub: `At a ${(result.inputs.real_discount_rate * 100).toFixed(1)}% real discount rate`,
      primary: true,
    },
    {
      label: "Required operating fleet",
      value: formatNumber(result.N_fleet),
      sub: `${formatNumber(result.planned_node_purchases)} nodes purchased over ${result.node_generations} generation${result.node_generations > 1 ? "s" : ""}`,
    },
    {
      label: "Wave resource capacity factor",
      value: formatPercent(result.derived.raw_wave_resource_cf, 1),
      sub: "Average output the waves provide, as a share of the node's maximum possible output.",
    },
    {
      label: "Cost per target watt",
      value: formatUsdPerUnit(result.presentValue.lifecycle_cost_per_target_watt_usd, 2),
      sub: `Per watt of ${result.inputs.target_capacity_gw} GW target capacity`,
    },
    {
      label: "LCOE",
      value: `${formatUsdPerUnit(result.lcoe.lcoe_usd_per_mwh, 2)}/MWh`,
      sub: "What it costs to generate one MWh of electricity, not counting compute equipment.",
    },
    {
      label: "Total workload data transferred",
      value: formatDataGb(result.costs.total_workload_data_transferred_gb),
      sub: "Fleet-wide, over the analysis period",
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
