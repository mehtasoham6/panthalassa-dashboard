import type { CSSProperties } from "react";
import { Link } from "react-router";
import { HORIZON_FRAC, NodeWaveHero } from "../components/NodeWaveHero.js";
import styles from "./WireframeHome.module.css";

/**
 * Home page: a flat Smoke White sky above the water line and a Cod Gray
 * sea below it where the copy sits. The two-plane background and the WebGL
 * hero share HORIZON_FRAC so the split lands on the horizon the sea
 * converges to.
 *
 * All copy on this page is placeholder on purpose. It has to be written by
 * a human before launch; the lorem ipsum stays visible so nobody mistakes
 * the layout for finished content.
 */

const LOREM_LEAD =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor " +
  "incididunt ut labore et dolore magna aliqua.";
const LOREM =
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip " +
  "ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit " +
  "esse cillum dolore eu fugiat nulla pariatur.";
const LOREM_2 =
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt " +
  "mollit anim id est laborum. Curabitur pretium tincidunt lacus, nulla gravida orci a odio.";

/** Six placeholder steps; the real list is the model's calculation order (spec § 1). */
const STEPS = [
  { question: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor?", result: "Lorem ipsum dolor sit amet" },
  { question: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris?", result: "Consectetur adipiscing elit" },
  { question: "Duis aute irure dolor in reprehenderit in voluptate velit esse?", result: "Sed do eiusmod tempor" },
  { question: "Excepteur sint occaecat cupidatat non proident, sunt in culpa?", result: "Incididunt ut labore et dolore" },
  { question: "Curabitur pretium tincidunt lacus, nulla gravida orci a odio?", result: "Magna aliqua ut enim" },
  { question: "Nullam varius, turpis et commodo pharetra, est eros bibendum elit?", result: "Ad minim veniam quis nostrud" },
];

export function WireframeHome() {
  const pageStyle = { "--horizon": `${HORIZON_FRAC * 100}%` } as CSSProperties;

  return (
    <div className={styles.page} style={pageStyle}>
      <section className={styles.hero}>
        <NodeWaveHero className={styles.canvas} />

        <header className={styles.topbar}>
          <Link to="/" className={styles.brand}>
            Panthalassa
          </Link>
          <nav className={styles.nav}>
            <Link to="/model" className={styles.navLink}>
              Model dashboard
            </Link>
          </nav>
        </header>

        <div className={styles.title}>
          <p className={styles.headline}>Wave Power</p>
        </div>

        {/* The name stands up out of the sea and cuts across the headline. */}
        <h1 className={styles.brandWord}>Panthalassa</h1>

        <div className={styles.copy}>
          <p>{LOREM_LEAD}</p>
          <p>{LOREM}</p>
          <Link to="/model" className={styles.cta}>
            Explore the model
          </Link>
        </div>
      </section>

      <section className={styles.body} aria-labelledby="how-title">
        <div className={styles.steps}>
          <h2 id="how-title">Section one</h2>
          <p className={styles.stepsLead}>{LOREM_2}</p>
          <ol className={styles.stepList}>
            {STEPS.map((step, i) => (
              <li key={step.result} className={styles.step}>
                <span className={`${styles.stepIndex} num`}>{i + 1}</span>
                <div>
                  <p className={styles.stepQuestion}>{step.question}</p>
                  <p className={styles.stepResult}>{step.result}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className={styles.scope}>
          <h2>Section two</h2>
          <p>{LOREM}</p>
          <p>{LOREM_2}</p>
          <Link to="/model" className={styles.scopeLink}>
            Open the model dashboard
          </Link>
        </aside>
      </section>
    </div>
  );
}
