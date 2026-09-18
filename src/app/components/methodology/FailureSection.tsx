import { FAILURES } from './storyData.js';
import styles from './Methodology.module.css';

/** Static, compact explanation: all outcomes enter normal page flow together. */
export function FailureSection() {
  return <section id="failures" className={styles.failureSection} aria-labelledby="failure-heading">
    <div className={styles.failureIntro}>
      <span className={styles.eyebrow}>04 / Account for failures</span>
      <h2 id="failure-heading">What reduces the node’s contribution?</h2>
      <p>The model estimates chip losses separately. For other failures, it weights each outcome’s lost output by its probability.</p>
    </div>
    <table className={styles.failureTable} aria-label="Failure categories and their effects on the model">
      <thead><tr><th scope="col">Failure</th><th scope="col">What the model counts</th></tr></thead>
      <tbody>{FAILURES.map(([title,body]) => <tr key={title}><th scope="row">{title}</th><td>{body}</td></tr>)}</tbody>
    </table>
    <div className={styles.failureCalculation} aria-label="Scheduled contribution minus expected losses equals expected contribution">
      <span>Scheduled contribution</span>
      <span><span aria-hidden="true">− </span>expected losses</span>
      <strong><span aria-hidden="true">= </span>expected contribution</strong>
    </div>
    <aside className={styles.failureAssumptions} aria-labelledby="failure-assumptions-heading">
      <h3 id="failure-assumptions-heading">The assumptions behind the estimate</h3>
      <p>Non-chip failure assumptions draw on maritime incident data. The <strong>failure-rate slider</strong> changes their overall frequency; outcome probabilities and detailed assumptions are in the appendix.</p>
    </aside>
  </section>;
}
