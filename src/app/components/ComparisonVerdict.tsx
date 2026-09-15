import type { ModelResult } from "../../model/index.js";
import type { TerrestrialModelResult } from "../../terrestrial/model/types.js";
import { formatUsdCompact } from "../lib/formatters.js";
import styles from "./ComparisonVerdict.module.css";

interface Props {
  oceanResult: ModelResult;
  terrestrialResult: TerrestrialModelResult;
}

/**
 * The one card that states the comparison outright. Both architectures are
 * sized to the same delivered-compute target, so undiscounted lifecycle cost
 * is directly comparable. The delta is computed from the two results, never
 * hand-written, and its direction is not assumed.
 */
export function ComparisonVerdict({ oceanResult, terrestrialResult }: Props) {
  const ocean = oceanResult.costs.total_node_fleet_cost_usd;
  const terrestrial = terrestrialResult.costs.total_lifecycle_cost_usd;
  const pct = Math.abs(1 - ocean / terrestrial) * 100;
  const same = pct < 0.05;
  const lower = ocean < terrestrial;

  return (
    <section className={`card ${styles.verdictCard}`} aria-labelledby="verdict-title">
      <div className={styles.head}>
        <h2 id="verdict-title" className={styles.title}>
          Total lifecycle cost
        </h2>
        <p className={styles.sub}>Undiscounted, over the analysis period, at the same delivered-compute target.</p>
      </div>
      <div className={styles.row}>
        <dl className={styles.values}>
          <div className={`${styles.value} ${styles.ocean}`}>
            <dt>Panthalassa</dt>
            <dd className="num">{formatUsdCompact(ocean)}</dd>
          </div>
          <div className={styles.value}>
            <dt>Terrestrial</dt>
            <dd className="num">{formatUsdCompact(terrestrial)}</dd>
          </div>
        </dl>
        <p className={`${styles.verdict} ${same ? "" : lower ? styles.lower : styles.higher}`}>
          {same ? (
            "The two architectures cost the same over the analysis period."
          ) : (
            <>
              Panthalassa costs <span className="num">{pct.toFixed(1)}%</span> {lower ? "less" : "more"} than the
              terrestrial build.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
