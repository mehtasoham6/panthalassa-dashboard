import { useMemo } from "react";
import { CONST, type ModelResult } from "../../model/index.js";
import { ALL_SLIDERS } from "../lib/sliderConfig.js";
import styles from "./NodeJourney.module.css";

interface Props {
  result: ModelResult;
}

const HULL_SLIDER = ALL_SLIDERS.find((s) => s.key === "hull_diameter_m")!;

// Illustrative-only normalization range for the transit-segment width (one-way
// days) -- purely how far the connector bar stretches between the port/return
// dots and the sea-park zone, not a modeled quantity in its own right. The
// underlying day count is the model's own derived.one_way_journey_days.
const TRANSIT_DAYS_MIN = 3;
const TRANSIT_DAYS_MAX = 85;
const TRANSIT_PCT_MIN = 12;
const TRANSIT_PCT_MAX = 30;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function NodeJourney({ result }: Props) {
  const { inputs, derived } = result;

  const transitPct = useMemo(() => {
    const t = clamp(derived.one_way_journey_days, TRANSIT_DAYS_MIN, TRANSIT_DAYS_MAX);
    const frac = (t - TRANSIT_DAYS_MIN) / (TRANSIT_DAYS_MAX - TRANSIT_DAYS_MIN);
    return TRANSIT_PCT_MIN + frac * (TRANSIT_PCT_MAX - TRANSIT_PCT_MIN);
  }, [derived.one_way_journey_days]);

  const hullScale = useMemo(() => {
    const frac = (inputs.hull_diameter_m - HULL_SLIDER.min) / (HULL_SLIDER.max - HULL_SLIDER.min);
    return 0.85 + clamp(frac, 0, 1) * 0.3; // modestly larger/smaller, 0.85x-1.15x
  }, [inputs.hull_diameter_m]);

  const batteryKwh = inputs.payload_rating_kw * inputs.battery_duration_hours;

  return (
    <div className="card">
      <div className={styles.wrap}>
        <span className={styles.title}>One-node journey</span>

        <div className={styles.track}>
          <div className={styles.endStage}>
            <span className={styles.dot} />
            <span className={styles.stageLabel}>Port</span>
          </div>

          <div className={styles.connector} style={{ flexBasis: `${transitPct}%` }}>
            <div className={styles.route} />
            <span className={styles.connectorCaption}>self-propelled</span>
            <span className={styles.connectorCaption}>{inputs.sea_park_distance_km.toFixed(0)} km</span>
          </div>

          <div className={styles.seaPark}>
            <span className={styles.stageLabel}>Sea park</span>
            <div className={styles.nodeIcon} style={{ transform: `scale(${hullScale})` }}>
              <svg viewBox="0 0 48 32" width="32" height="22" aria-hidden="true">
                <rect x="4" y="15" width="40" height="13" rx="6.5" style={{ fill: "var(--accent)" }} />
                <rect x="19" y="4" width="10" height="13" rx="2.5" style={{ fill: "var(--accent-strong)" }} />
                <circle cx="24" cy="9" r="1.6" style={{ fill: "var(--surface)" }} />
              </svg>
            </div>
            <div className={styles.nodeStats}>
              <span className={`${styles.statValue} num`}>{inputs.payload_rating_kw} kW</span>
              <span className={styles.statLabel}>compute</span>
            </div>
            <span className={styles.batteryChip}>
              {inputs.battery_duration_hours}h battery · {batteryKwh.toFixed(0)} kWh
            </span>
            <span className={styles.stageCaption}>operates here</span>
          </div>

          <div className={styles.connector} style={{ flexBasis: `${transitPct}%` }}>
            <div className={styles.route} />
            <span className={styles.connectorCaption}>return</span>
          </div>

          <div className={styles.endStage}>
            <span className={styles.dot} />
            <span className={styles.stageLabel}>Service</span>
            <span className={styles.stageCaption}>{CONST.node_maintenance_dock_days}-day dock</span>
          </div>
        </div>
      </div>
    </div>
  );
}
