import styles from "./CostBreakdown.module.css";
import { formatUsdCompact } from "../lib/formatters.js";

export interface CostCategory {
  label: string;
  description: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  categories: CostCategory[];
  footnote?: string;
}

function formatShare(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 0.05) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

/**
 * Ranked bar list, shared by the ocean and terrestrial breakdowns. Each row
 * is its own bar against the same full-width track, so categories that are a
 * fraction of a percent still read as labelled rows rather than vanishing
 * into a single stacked bar. Bars are scaled to share of total, so the
 * dominant category fills most of its track and the small ones stay honest.
 */
export function CostBreakdownList({ title, categories, footnote }: Props) {
  const total = categories.reduce((sum, c) => sum + c.value, 0);
  const ranked = [...categories].sort((a, b) => b.value - a.value);

  return (
    <section className="card">
      <div className={styles.wrap}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span className={`${styles.totalValue} num`}>{formatUsdCompact(total)} total</span>
        </div>

        <ol className={styles.rows}>
          {ranked.map((c) => {
            const share = total > 0 ? c.value / total : 0;
            return (
              <li key={c.label} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.rowLabel}>{c.label}</span>
                  <span className={styles.rowValue}>
                    <span className="num">{formatUsdCompact(c.value)}</span>
                    <span className={`${styles.rowShare} num`}>{formatShare(share)}</span>
                  </span>
                </div>
                <div className={styles.track} aria-hidden="true">
                  <div className={styles.fill} style={{ width: `${share * 100}%`, background: c.color }} />
                </div>
                <p className={styles.rowDesc}>{c.description}</p>
              </li>
            );
          })}
        </ol>

        {footnote && <p className={styles.footnote}>{footnote}</p>}
      </div>
    </section>
  );
}
