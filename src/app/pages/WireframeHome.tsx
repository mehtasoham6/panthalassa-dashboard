import type { CSSProperties } from "react";
import { Link } from "react-router";
import { HORIZON_FRAC, NodeWaveHero } from "../components/NodeWaveHero.js";
import styles from "./WireframeHome.module.css";
import { Methodology } from "../components/methodology/Methodology.js";

/**
 * Home page: a flat Smoke White sky above the water line and a Cod Gray
 * sea below it where the copy sits. The two-plane background and the WebGL
 * hero share HORIZON_FRAC so the split lands on the horizon the sea
 * converges to.
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

  return (
    <div className={styles.page} style={pageStyle}>
      <section className={styles.hero}>
        <NodeWaveHero className={styles.canvas} />

        <header className={styles.topbar}>
          <Link to="/" className={styles.brand}>
            Panthalassa
          </Link>
          <nav className={styles.nav}>
            <Link to="/old" className={styles.navLink}>
              Model dashboard
            </Link>
          </nav>
        </header>

        <div className={styles.title}>
          <h1 className={styles.headline}>Wave Power</h1>
        </div>

        <div className={styles.copy}>
          <p>{LOREM_LEAD}</p>
          <p>{LOREM}</p>
          <Link to="/old" className={styles.cta}>
            Explore the model
          </Link>
        </div>
      </section>

      <Methodology />
    </div>
  );
}
