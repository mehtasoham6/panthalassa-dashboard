import { useEffect, type CSSProperties } from "react";
import { HORIZON_FRAC, NodeWaveHero } from "../components/NodeWaveHero.js";
import styles from "./WireframeHome.module.css";
import { Methodology } from "../components/methodology/Methodology.js";
import { Appendix } from "../components/appendix/Appendix.js";
import { Takeaways } from "../components/Takeaways.js";
import { OldDashboard } from "./OldDashboard.js";

/**
 * Home page, option A: toned-down wireframe look. Mid-day sky above the
 * water line, dark below it where the copy sits. The background gradient
 * and the WebGL hero share HORIZON_FRAC so the sky/deep split lands on the
 * horizon the sea converges to.
 */

export function WireframeHome() {
  const pageStyle = { "--horizon": `${HORIZON_FRAC * 100}%` } as CSSProperties;

  // React renders the target after initial navigation, including legacy /old links.
  useEffect(() => {
    if (["#dashboard", "#appendix"].includes(window.location.hash)) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
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
          <p><strong>Yes it can and, done right, it would be cheaper than building data centers on land.</strong></p>
          <p>This work models one approach to harnessing wave energy put forward by the startup <strong>Panthalassa</strong>, which would place floating power plants far offshore in the South Pacific, and compares this to a range of land-based behind-the-meter alternatives. While Panthalassa’s approach poses significant operational challenges, <strong>my model finds that these challenges are likely surmountable.</strong></p>
          <p>You can go straight to the dashboard, where you can change my default assumptions, but since few of us have any physical intuition for ocean data centers, <strong>I strongly encourage you to first read my short explanation of how Panthalassa operates and how my model works.</strong></p>
          <a href="#dashboard" className={styles.cta}>
            Skip the explanation
            <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </section>

      <Methodology />
      <section id="dashboard" className={styles.dashboard} aria-label="Interactive model dashboard" tabIndex={-1}>
        <OldDashboard />
      </section>
      <Takeaways />
      <Appendix />
    </div>
  );
}
