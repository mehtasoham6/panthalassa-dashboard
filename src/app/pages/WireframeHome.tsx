import type { CSSProperties } from "react";
import { Link } from "react-router";
import { HORIZON_FRAC, NodeWaveHero } from "../components/NodeWaveHero.js";
import styles from "./WireframeHome.module.css";

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
const LOREM_2 =
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt " +
  "mollit anim id est laborum. Curabitur pretium tincidunt lacus, nulla gravida orci a odio.";

const SECTIONS = ["Section one", "Section two", "Section three"];

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
          <span className={styles.eyebrow}>Ocean-2 node</span>
          <h1 className={styles.headline}>Wave Power</h1>
        </div>

        <div className={styles.copy}>
          <p>{LOREM_LEAD}</p>
          <p>{LOREM}</p>
          <Link to="/old" className={styles.cta}>
            Explore the model
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      <section className={styles.body}>
        {SECTIONS.map((title) => (
          <div key={title}>
            <h2>{title}</h2>
            <p>{LOREM_2}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
