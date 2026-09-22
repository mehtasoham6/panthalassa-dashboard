import { useEffect, type CSSProperties } from "react";
import { HORIZON_FRAC, NodeWaveHero } from "../components/NodeWaveHero.js";
import styles from "./WireframeHome.module.css";
import { Methodology } from "../components/methodology/Methodology.js";
import { OldDashboard } from "./OldDashboard.js";

/**
 * Home page, option A: toned-down wireframe look. Mid-day sky above the
 * water line, dark below it where the copy sits. The background gradient
 * and the WebGL hero share HORIZON_FRAC so the sky/deep split lands on the
 * horizon the sea converges to.
 */

const LOREM_LEAD =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor " +
  "incididunt ut labore et dolore magna aliqua.";
const LOREM =
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip " +
  "ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit " +
  "esse cillum dolore eu fugiat nulla pariatur.";
export function WireframeHome() {
  const pageStyle = { "--horizon": `${HORIZON_FRAC * 100}%` } as CSSProperties;

  // React renders the target after initial navigation, including legacy /old links.
  useEffect(() => {
    if (window.location.hash === "#dashboard") {
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "instant" });
    }
  }, []);

  return (
    <div className={styles.page} style={pageStyle}>
      <section className={styles.hero}>
        <NodeWaveHero className={styles.canvas} />

        <div className={styles.title}>
          <h1 className={styles.headline}>Can the Ocean Power AI?</h1>
          <p className={styles.heroSubtitle}>
            Modeling the cost and reliability of wave-powered data centers, and how they compare with data centers on land.
          </p>
        </div>

        <div className={styles.copy}>
          <p>{LOREM_LEAD}</p>
          <p>{LOREM}</p>
          <a href="#dashboard" className={styles.cta}>
            Explore the model
            <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </section>

      <Methodology />
      <section id="dashboard" className={styles.dashboard} aria-label="Interactive model dashboard" tabIndex={-1}>
        <OldDashboard />
      </section>
    </div>
  );
}
