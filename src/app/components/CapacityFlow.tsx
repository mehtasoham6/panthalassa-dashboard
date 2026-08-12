import { useMemo } from "react";
import type { ModelResult } from "../../model/index.js";
import styles from "./CapacityFlow.module.css";

interface Props {
  result: ModelResult;
}

// Flow ribbon geometry: three real (honestly proportional) points --
// installed, after wear & servicing, delivered. Fixed viewBox stretched to
// the card's actual width.
const VIEW_W = 640;
const VIEW_H = 90;
const CY = 45;
const MAX_HALF_H = 34;
const MIN_HALF_H = 3;
const X0 = 10;
const X1 = 250;
const X2 = 630;

function ribbonPath(h0: number, h1: number, h2: number): string {
  const midA = (X0 + X1) / 2;
  const midB = (X1 + X2) / 2;
  return [
    `M ${X0} ${CY - h0}`,
    `C ${midA} ${CY - h0}, ${midA} ${CY - h1}, ${X1} ${CY - h1}`,
    `C ${midB} ${CY - h1}, ${midB} ${CY - h2}, ${X2} ${CY - h2}`,
    `L ${X2} ${CY + h2}`,
    `C ${midB} ${CY + h2}, ${midB} ${CY + h1}, ${X1} ${CY + h1}`,
    `C ${midA} ${CY + h1}, ${midA} ${CY + h0}, ${X0} ${CY + h0}`,
    "Z",
  ].join(" ");
}

/** Adaptive kWh formatting -- wear & servicing lands in the hundreds of MWh, a rare catastrophic loss can be a fraction of one kWh. */
function formatEnergy(kwh: number): string {
  const abs = Math.abs(kwh);
  if (abs >= 1e6) return `${(kwh / 1e6).toFixed(1)} GWh`;
  if (abs >= 1e3) return `${(kwh / 1e3).toFixed(1)} MWh`;
  if (abs >= 1) return `${kwh.toFixed(1)} kWh`;
  return `${kwh.toFixed(2)} kWh`;
}

interface BreakdownCategory {
  key: string;
  label: string;
  description: string;
  valueKwh: number;
  color: string;
}

// Mild -> severe, ending at the dashboard's existing failure color.
const COLORS = ["#3f7d78", "#7c8a5a", "#a67a4a", "#a8623f"];

export function CapacityFlow({ result }: Props) {
  const { inputs, chip, derived, modeLosses } = result;

  const installedKw = inputs.payload_rating_kw;
  // Average kW after wave/route physics and continuous chip-health decay,
  // before Modes 2-5 -- chip_adjusted_energy_kwh and analysis_period_hours
  // are both already-computed model outputs; this is just kWh / hours = kW.
  const afterWearKw = chip.chip_adjusted_energy_kwh / derived.analysis_period_hours;
  // Same formula already used elsewhere on the dashboard for "delivered output per node".
  const deliveredKw = (result.expected_delivered_energy_per_position_mw_years / inputs.analysis_period_years) * 1000;

  const installedEnergyKwh = installedKw * derived.analysis_period_hours;
  const wearLossKwh = Math.max(0, installedEnergyKwh - chip.chip_adjusted_energy_kwh);
  const failureCategories: BreakdownCategory[] = [
    {
      key: "self-recover",
      label: "Self-recovers",
      description: "Breaks down but returns to port under its own power.",
      valueKwh: modeLosses.mode_2_loss_kwh,
      color: COLORS[0]!,
    },
    {
      key: "tow",
      label: "Needs a tow",
      description: "Breaks down and has to be towed back.",
      valueKwh: modeLosses.mode_3_loss_kwh,
      color: COLORS[1]!,
    },
    {
      key: "lost",
      label: "Node lost",
      description: "Lost at sea -- unrecoverable, replaced.",
      valueKwh: modeLosses.mode_4_loss_kwh,
      color: COLORS[2]!,
    },
    {
      key: "catastrophic",
      label: "Catastrophic",
      description: "Major accident requiring cleanup.",
      valueKwh: modeLosses.mode_5_loss_kwh,
      color: COLORS[3]!,
    },
  ];
  const failureLossKwh = failureCategories.reduce((sum, c) => sum + c.valueKwh, 0);

  const ribbonPathD = useMemo(() => {
    const scale = (kw: number) => Math.max(MIN_HALF_H, (kw / installedKw) * MAX_HALF_H);
    return ribbonPath(scale(installedKw), scale(afterWearKw), scale(deliveredKw));
  }, [installedKw, afterWearKw, deliveredKw]);

  return (
    <div className="card">
      <div className={styles.wrap}>
        <span className={styles.title}>Where installed compute capacity goes</span>

        <div className={styles.summaryRow}>
          <div className={styles.endLabel}>
            <span className={`${styles.endValue} num`}>{installedKw.toFixed(0)} kW</span>
            <span className={styles.endCaption}>installed</span>
          </div>
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className={styles.ribbonSvg}>
            <path d={ribbonPathD} fill="var(--accent)" />
          </svg>
          <div className={`${styles.endLabel} ${styles.endLabelRight}`}>
            <span className={`${styles.endValue} num`}>{deliveredKw.toFixed(0)} kW</span>
            <span className={styles.endCaption}>delivered / node</span>
          </div>
        </div>

        <div className={styles.twoStat}>
          <div className={styles.statBlock}>
            <span className={`${styles.statValue} num`}>{formatEnergy(wearLossKwh)}</span>
            <span className={styles.statLabel}>lost to compute wear &amp; servicing</span>
          </div>
          <div className={styles.statBlock}>
            <span className={`${styles.statValue} num`}>{formatEnergy(failureLossKwh)}</span>
            <span className={styles.statLabel}>lost to breakdown risk, below</span>
          </div>
        </div>

        <div className={styles.breakdownBar}>
          {failureCategories.map((c) => (
            <div
              key={c.key}
              className={styles.segment}
              style={{ flexBasis: `${(c.valueKwh / failureLossKwh) * 100}%`, background: c.color }}
              title={`${c.label}: ${formatEnergy(c.valueKwh)}`}
            />
          ))}
        </div>

        <div className={styles.legend}>
          {failureCategories.map((c) => (
            <div key={c.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: c.color }} />
              <span className={styles.legendText}>
                <span className={styles.legendLabel}>
                  {c.label} <span className={`${styles.legendValue} num`}>{formatEnergy(c.valueKwh)}</span>
                </span>
                <span className={styles.legendDescription}>{c.description}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
