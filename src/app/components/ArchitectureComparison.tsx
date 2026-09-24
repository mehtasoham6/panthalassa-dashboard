import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { comparableOutputsFromPanthalassa } from "../../terrestrial/integration/index.js";
import { formatUsdCompact } from "../lib/formatters.js";
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
 * kept below reflects a genuine architectural difference. "All-in cost per
 * target watt" is broken down by cost component in CostPerWattBreakdown
 * (rendered just below this card), so it isn't repeated here. Power-system
 * LCOE has its own headline card pair (LcoeBand/TerrestrialLcoeBand) instead
 * of a row here.
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
      label: "Initial compute-hardware capex",
      ocean: formatUsdCompact(ocean.initial_compute_hardware_capex_usd),
      terrestrial: formatUsdCompact(terrestrial.initial_compute_hardware_capex_usd),
    },
  ];

  return (
    <div className="card">
      <div className={styles.wrap}>
        <div className={styles.headerRow}>
          <span className={styles.cornerLabel}>Comparable outputs</span>
          <span className={styles.colHeader}>Panthalassa</span>
          <span className={styles.colHeader}>Land-based</span>
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
