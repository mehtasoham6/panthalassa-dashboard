import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { comparableOutputsFromPanthalassa } from "../../terrestrial/integration/index.js";
import { formatDataGb, formatUsdCompact, formatUsdPerUnit } from "../lib/formatters.js";
import styles from "./ArchitectureComparison.module.css";

interface Props {
  oceanResult: ModelResult;
  terrestrialResult: TerrestrialModelResult;
}

/**
 * Target delivered compute and delivered compute energy are omitted here:
 * both architectures are forced to hit the same shared target_capacity_gw,
 * so those two rows are always identical (or, for ocean, only trivially
 * off by fleet-rounding) -- a tautology, not a real comparison. Every row
 * kept below reflects a genuine architectural difference.
 */
export function ArchitectureComparison({ oceanResult, terrestrialResult }: Props) {
  const ocean = comparableOutputsFromPanthalassa(oceanResult);
  const terrestrial = terrestrialResult.comparable;

  const rows = [
    {
      label: "Present-value lifecycle cost",
      ocean: formatUsdCompact(ocean.present_value_lifecycle_cost_usd),
      terrestrial: formatUsdCompact(terrestrial.present_value_lifecycle_cost_usd),
    },
    {
      label: "Cost per target watt",
      ocean: formatUsdPerUnit(ocean.lifecycle_cost_per_target_watt_usd, 2) + "/W",
      terrestrial: formatUsdPerUnit(terrestrial.lifecycle_cost_per_target_watt_usd, 2) + "/W",
    },
    {
      label: "Power-system LCOE",
      ocean: formatUsdPerUnit(ocean.power_system_lcoe_usd_per_mwh, 2) + "/MWh",
      terrestrial: formatUsdPerUnit(terrestrial.power_system_lcoe_usd_per_mwh, 2) + "/MWh",
    },
    {
      label: "Initial compute-hardware capex",
      ocean: formatUsdCompact(ocean.initial_compute_hardware_capex_usd),
      terrestrial: formatUsdCompact(terrestrial.initial_compute_hardware_capex_usd),
    },
    {
      label: "Workload data transferred",
      ocean: `${formatDataGb(ocean.total_workload_data_transferred_gb)} · ${formatUsdCompact(ocean.present_value_workload_data_transfer_cost_usd)} PV`,
      terrestrial: `${formatDataGb(terrestrial.total_workload_data_transferred_gb)} · ${formatUsdCompact(terrestrial.present_value_workload_data_transfer_cost_usd)} PV`,
    },
  ];

  return (
    <div className="card">
      <div className={styles.wrap}>
        <div className={styles.headerRow}>
          <span className={styles.cornerLabel}>Comparable outputs</span>
          <span className={styles.colHeader}>Panthalassa</span>
          <span className={styles.colHeader}>Terrestrial</span>
        </div>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <span className={styles.rowLabel}>{row.label}</span>
            <span className={`${styles.rowValue} num`}>{row.ocean}</span>
            <span className={`${styles.rowValue} num`}>{row.terrestrial}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
