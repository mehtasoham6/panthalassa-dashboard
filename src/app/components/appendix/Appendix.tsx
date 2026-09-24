import markup from "./appendix.html?raw";
import styles from "./Appendix.module.css";

// Trusted, repository-owned editorial content with pre-rendered MathML.
// Native details elements keep the appendix usable without animation or JS controls.
export function Appendix() {
  return <section id="appendix" className={styles.appendix} aria-labelledby="appendix-heading"
    dangerouslySetInnerHTML={{ __html: markup }} />;
}
