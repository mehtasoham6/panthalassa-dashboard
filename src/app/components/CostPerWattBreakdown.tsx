import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { comparableOutputsFromPanthalassa } from "../../terrestrial/integration/index.js";
import { formatUsdPerUnit } from "../lib/formatters.js";
import styles from "./CostPerWattBreakdown.module.css";

interface Props {
  oceanResult: ModelResult;
  terrestrialResult: TerrestrialModelResult;
}

const fmtW = (value: number) => `${formatUsdPerUnit(value, 2)}/W`;
const fmtMwh = (value: number) => `${formatUsdPerUnit(value, 0)}/MWh`;

/**
 * Every figure here is a genuine (not approximated) present-value $/W-of-
 * target-capacity number: each cost category is discounted independently
 * (see presentValue.ts / terrestrial model.ts's per-category schedules) and
 * the categories sum exactly to the "All-in cost per target watt" total by
 * construction (linearity of discounting), not by rounding luck. A node
 * bundles generation + free wave "fuel" + housing into one physical unit,
 * so its value spans the three terrestrial rows it replaces.
 */
export function CostPerWattBreakdown({ oceanResult, terrestrialResult }: Props) {
  const oceanWatts = oceanResult.inputs.target_capacity_gw * 1_000_000_000;
  const terrestrialWatts = terrestrialResult.inputs.target_capacity_gw * 1_000_000_000;
  const oceanPerWatt = (usd: number) => usd / oceanWatts;
  const terrestrialPerWatt = (usd: number) => usd / terrestrialWatts;

  const oceanComparable = comparableOutputsFromPanthalassa(oceanResult);
  const terrestrialComparable = terrestrialResult.comparable;

  const oceanNodes = oceanPerWatt(oceanResult.presentValue.present_value_nodes_cost_usd);
  const oceanChips = oceanPerWatt(oceanResult.presentValue.present_value_chips_cost_usd);
  const oceanData = oceanPerWatt(oceanResult.presentValue.present_value_workload_data_transfer_cost_usd);
  const oceanOtherOpex = oceanPerWatt(oceanResult.presentValue.present_value_other_opex_cost_usd);
  const oceanTotal = oceanComparable.lifecycle_cost_per_target_watt_usd;

  const terrestrialPowerPlant = terrestrialPerWatt(terrestrialResult.presentValue.present_value_power_plant_cost_usd);
  const terrestrialFuel = terrestrialPerWatt(terrestrialResult.presentValue.present_value_fuel_cost_usd);
  const terrestrialDataCenter = terrestrialPerWatt(terrestrialResult.presentValue.present_value_data_center_cost_usd);
  const terrestrialChips = terrestrialPerWatt(terrestrialResult.presentValue.present_value_chips_cost_usd);
  const terrestrialData = terrestrialPerWatt(terrestrialResult.presentValue.present_value_workload_data_transfer_cost_usd);
  const terrestrialOtherOpex = terrestrialPerWatt(terrestrialResult.presentValue.present_value_other_opex_cost_usd);
  const terrestrialTotal = terrestrialComparable.lifecycle_cost_per_target_watt_usd;

  const oceanPerMwh = oceanComparable.present_value_lifecycle_cost_usd / oceanComparable.analysis_period_delivered_compute_mwh;
  const terrestrialPerMwh =
    terrestrialComparable.present_value_lifecycle_cost_usd / terrestrialComparable.analysis_period_delivered_compute_mwh;

  const col = { label: 1, ocean: 2, terrestrial: 3 } as const;

  return (
    <div className="card">
      <div className={styles.wrap}>
        <div className={styles.titleRow}>
          <span className={styles.title}>All-in cost per target watt, by component</span>
          <span className={styles.subtitle}>Present-value $/W of target capacity</span>
        </div>

        <div className={styles.grid}>
          <span className={styles.cornerLabel} style={{ gridColumn: col.label, gridRow: 1 }}>
            Component
          </span>
          <span className={styles.colHeader} style={{ gridColumn: col.ocean, gridRow: 1 }}>
            Panthalassa
          </span>
          <span className={styles.colHeader} style={{ gridColumn: col.terrestrial, gridRow: 1 }}>
            Terrestrial
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 2 }}>
            Power plant
          </span>
          <span
            className={`${styles.nodesCell} num`}
            style={{ gridColumn: col.ocean, gridRow: "2 / span 3" }}
          >
            <span className={styles.nodesLabel}>Nodes</span>
            <span className={styles.nodesValue}>{fmtW(oceanNodes)}</span>
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 2 }}>
            {fmtW(terrestrialPowerPlant)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 3 }}>
            Fuel
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 3 }}>
            {fmtW(terrestrialFuel)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 4 }}>
            Data center
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 4 }}>
            {fmtW(terrestrialDataCenter)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 5 }}>
            Chips
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.ocean, gridRow: 5 }}>
            {fmtW(oceanChips)}
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 5 }}>
            {fmtW(terrestrialChips)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 6 }}>
            Data
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.ocean, gridRow: 6 }}>
            {fmtW(oceanData)}
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 6 }}>
            {fmtW(terrestrialData)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 7 }}>
            Other opex
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.ocean, gridRow: 7 }}>
            {fmtW(oceanOtherOpex)}
          </span>
          <span className={`${styles.rowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 7 }}>
            {fmtW(terrestrialOtherOpex)}
          </span>

          <span className={styles.totalLabel} style={{ gridColumn: col.label, gridRow: 8 }}>
            All-in cost per target watt
          </span>
          <span className={`${styles.totalValue} num`} style={{ gridColumn: col.ocean, gridRow: 8 }}>
            {fmtW(oceanTotal)}
          </span>
          <span className={`${styles.totalValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 8 }}>
            {fmtW(terrestrialTotal)}
          </span>

          <span className={styles.lastRowLabel} style={{ gridColumn: col.label, gridRow: 9 }}>
            Cost per MWh (delivered compute)
          </span>
          <span className={`${styles.lastRowValue} num`} style={{ gridColumn: col.ocean, gridRow: 9 }}>
            {fmtMwh(oceanPerMwh)}
          </span>
          <span className={`${styles.lastRowValue} num`} style={{ gridColumn: col.terrestrial, gridRow: 9 }}>
            {fmtMwh(terrestrialPerMwh)}
          </span>
        </div>
      </div>
    </div>
  );
}
