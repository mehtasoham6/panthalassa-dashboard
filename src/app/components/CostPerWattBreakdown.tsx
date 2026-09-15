import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { comparableOutputsFromPanthalassa } from "../../terrestrial/integration/index.js";
import { formatUsdPerUnit } from "../lib/formatters.js";
import { SideMark } from "./SideMark.js";
import { highlightClass, lowerSide } from "../lib/compare.js";
import styles from "./CostPerWattBreakdown.module.css";

interface Props {
  oceanResult: ModelResult;
  terrestrialResult: TerrestrialModelResult;
}

const fmtW = (value: number) => `${formatUsdPerUnit(value, 2)}/W`;
const fmtMwh = (value: number) => `${formatUsdPerUnit(value, 0)}/MWh`;

/**
 * Every figure here is a genuine (not approximated) present-value $/W-of-
 * target-capacity number, and every row is a full total-cost-of-ownership
 * for that component -- capex plus its own present-valued operating costs
 * (O&M, maintenance, decommissioning), not capex alone. There is
 * deliberately no "other opex" row: every recurring cost already belongs to
 * one of the rows shown, so a catch-all bucket would always read $0.00/W.
 * Each cost category is discounted independently (see presentValue.ts /
 * terrestrial model.ts's per-category schedules) and the categories sum
 * exactly to the "All-in cost per target watt" total by construction
 * (linearity of discounting), not by rounding luck. A node bundles
 * generation + free wave "fuel" + housing into one physical unit, so its
 * value spans the three terrestrial rows it replaces.
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
  const oceanTotal = oceanComparable.lifecycle_cost_per_target_watt_usd;

  const terrestrialPowerPlant = terrestrialPerWatt(terrestrialResult.presentValue.present_value_power_plant_cost_usd);
  const terrestrialFuel = terrestrialPerWatt(terrestrialResult.presentValue.present_value_fuel_cost_usd);
  const terrestrialDataCenter = terrestrialPerWatt(terrestrialResult.presentValue.present_value_data_center_cost_usd);
  const terrestrialChips = terrestrialPerWatt(terrestrialResult.presentValue.present_value_chips_cost_usd);
  const terrestrialData = terrestrialPerWatt(terrestrialResult.presentValue.present_value_workload_data_transfer_cost_usd);
  const terrestrialTotal = terrestrialComparable.lifecycle_cost_per_target_watt_usd;

  const oceanPerMwh = oceanComparable.present_value_lifecycle_cost_usd / oceanComparable.analysis_period_delivered_compute_mwh;
  const terrestrialPerMwh =
    terrestrialComparable.present_value_lifecycle_cost_usd / terrestrialComparable.analysis_period_delivered_compute_mwh;

  const col = { label: 1, ocean: 2, terrestrial: 3 } as const;

  // Rows where both sides have a like-for-like figure get the lower one highlighted.
  // The node cell stands in for three terrestrial rows, so it is not scored.
  const marks = { ocean: styles.betterOcean!, land: styles.betterLand!, worse: styles.worse! };
  const better = {
    chips: lowerSide(oceanChips, terrestrialChips),
    data: lowerSide(oceanData, terrestrialData),
    total: lowerSide(oceanTotal, terrestrialTotal),
    perMwh: lowerSide(oceanPerMwh, terrestrialPerMwh),
  };

  return (
    <div className="card">
      <div className={styles.wrap}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>All-in cost per target watt, by component</h2>
          <span className={styles.subtitle}>Present-value $/W of target capacity (capex + lifetime opex)</span>
        </div>

        <div className={styles.grid}>
          <span className={styles.cornerLabel} style={{ gridColumn: col.label, gridRow: 1 }}>
            Component
          </span>
          <span className={styles.colHeader} style={{ gridColumn: col.ocean, gridRow: 1 }}>
            <SideMark side="ocean" />
            Panthalassa
          </span>
          <span className={styles.colHeader} style={{ gridColumn: col.terrestrial, gridRow: 1 }}>
            <SideMark side="land" />
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
          <span
            className={`${styles.rowValue} num ${highlightClass(better.chips, "ocean", marks)}`}
            style={{ gridColumn: col.ocean, gridRow: 5 }}
          >
            {fmtW(oceanChips)}
          </span>
          <span
            className={`${styles.rowValue} num ${highlightClass(better.chips, "land", marks)}`}
            style={{ gridColumn: col.terrestrial, gridRow: 5 }}
          >
            {fmtW(terrestrialChips)}
          </span>

          <span className={styles.rowLabel} style={{ gridColumn: col.label, gridRow: 6 }}>
            Data
          </span>
          <span
            className={`${styles.rowValue} num ${highlightClass(better.data, "ocean", marks)}`}
            style={{ gridColumn: col.ocean, gridRow: 6 }}
          >
            {fmtW(oceanData)}
          </span>
          <span
            className={`${styles.rowValue} num ${highlightClass(better.data, "land", marks)}`}
            style={{ gridColumn: col.terrestrial, gridRow: 6 }}
          >
            {fmtW(terrestrialData)}
          </span>

          <span className={styles.totalLabel} style={{ gridColumn: col.label, gridRow: 7 }}>
            All-in cost per target watt
          </span>
          <span
            className={`${styles.totalValue} num ${highlightClass(better.total, "ocean", marks)}`}
            style={{ gridColumn: col.ocean, gridRow: 7 }}
          >
            {fmtW(oceanTotal)}
          </span>
          <span
            className={`${styles.totalValue} num ${highlightClass(better.total, "land", marks)}`}
            style={{ gridColumn: col.terrestrial, gridRow: 7 }}
          >
            {fmtW(terrestrialTotal)}
          </span>

          <span className={styles.lastRowLabel} style={{ gridColumn: col.label, gridRow: 8 }}>
            Cost per MWh (delivered compute)
          </span>
          <span
            className={`${styles.lastRowValue} num ${highlightClass(better.perMwh, "ocean", marks)}`}
            style={{ gridColumn: col.ocean, gridRow: 8 }}
          >
            {fmtMwh(oceanPerMwh)}
          </span>
          <span
            className={`${styles.lastRowValue} num ${highlightClass(better.perMwh, "land", marks)}`}
            style={{ gridColumn: col.terrestrial, gridRow: 8 }}
          >
            {fmtMwh(terrestrialPerMwh)}
          </span>
        </div>
      </div>
    </div>
  );
}
