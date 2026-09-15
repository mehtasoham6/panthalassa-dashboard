import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { formatUsdCompact } from "../lib/formatters.js";
import { SideMark } from "./SideMark.js";
import styles from "./ComparisonVerdict.module.css";

interface Props {
  oceanResult: ModelResult;
  terrestrialResult: TerrestrialModelResult;
}

/** The difference segment only gets an inline label when it is wide enough to hold one. */
const LABEL_MIN_FRACTION = 0.14;

/**
 * The one card that states the comparison outright, and draws it. Both
 * architectures are sized to the same delivered-compute target, so
 * undiscounted lifecycle cost is directly comparable. The two bars share a
 * scale set by the dearer build; the stretch of the longer bar beyond the
 * shorter one is the overage, and it breaks into Frontier Crimson.
 * Nothing here assumes which side is cheaper.
 */
export function ComparisonVerdict({ oceanResult, terrestrialResult }: Props) {
  const ocean = oceanResult.costs.total_node_fleet_cost_usd;
  const terrestrial = terrestrialResult.costs.total_lifecycle_cost_usd;
  const longer = Math.max(ocean, terrestrial);
  const shorter = Math.min(ocean, terrestrial);
  const pct = Math.abs(1 - ocean / terrestrial) * 100;
  const same = pct < 0.05;
  const lower = ocean < terrestrial;
  const shortFraction = shorter / longer;
  const diff = longer - shorter;

  const sides = [
    { key: "ocean" as const, label: "Panthalassa", value: ocean },
    { key: "land" as const, label: "Terrestrial", value: terrestrial },
  ];

  return (
    <section className={`card ${styles.verdictCard}`} aria-labelledby="verdict-title">
      <div className={styles.head}>
        <h2 id="verdict-title" className={styles.title}>
          Total lifecycle cost
        </h2>
        <p className={styles.sub}>Undiscounted, over the analysis period, at the same delivered-compute target.</p>
      </div>

      <ul className={styles.bars}>
        {sides.map((side) => {
          const isLonger = !same && side.value === longer;
          return (
            <li key={side.key} className={styles.barRow}>
              <span className={styles.barLabel}>
                <SideMark side={side.key} />
                {side.label}
              </span>
              <span className={`${styles.barValue} num`}>{formatUsdCompact(side.value)}</span>
              <div className={styles.track} aria-hidden="true">
                <span
                  className={`${styles.fill} ${side.key === "ocean" ? styles.fillOcean : styles.fillLand}`}
                  style={{ width: `${(isLonger ? shortFraction : side.value / longer) * 100}%` }}
                />
                {isLonger && (
                  <span className={styles.diff} style={{ width: `${(1 - shortFraction) * 100}%` }}>
                    {1 - shortFraction >= LABEL_MIN_FRACTION && (
                      <span className={`${styles.diffLabel} num`}>+{formatUsdCompact(diff)}</span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className={styles.verdict}>
        {same ? (
          "The two architectures cost the same over the analysis period."
        ) : (
          <>
            <strong className={`${styles.big} num`}>{pct.toFixed(1)}%</strong>
            <span className={styles.verdictText}>
              {lower ? "less" : "more"} than the terrestrial build.{" "}
              {lower ? "Panthalassa saves" : "Panthalassa costs an extra"}{" "}
              <span className="num">{formatUsdCompact(diff)}</span> over the analysis period.
            </span>
          </>
        )}
      </p>
    </section>
  );
}
