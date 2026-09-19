import { FAILURES } from './storyData.js';
import styles from './Methodology.module.css';

/** Static, compact explanation: all outcomes enter normal page flow together. */
export function FailureSection() {
  return <section id="failures" className={styles.failureSection} aria-labelledby="failure-heading">
    <div className={styles.failureIntro}>
      <h2 id="failure-heading">Adjusting for failures</h2>
      <p>Output lost from failures that cause unexpected downtime, maintenance, or even total node loss is then subtracted from the scheduled output calculated in the previous step. Gradual chip degradation is modeled separately from incidents that interrupt the whole node. For those incidents, the failure rate slider sets their overall frequency: for example, a 3% setting means an average of three incidents per 100 nodes operating for one year.</p>
      <p>The model divides that rate among four kinds of node failures using fixed probability weights. It then multiplies each outcome’s expected number of incidents by the computing contribution lost per incident, and adds those losses together.</p>
    </div>
    <table className={styles.failureTable} aria-label="Failure categories and their effects on the model">
      <thead><tr><th scope="col">Failure</th><th scope="col">What the model counts</th></tr></thead>
      <tbody>{FAILURES.map(([title,body],index) => <tr key={title} className={index > 0 ? styles.nodeFailureRow : undefined}><th scope="row">{title}</th><td>{body}</td></tr>)}</tbody>
    </table>
    <aside className={styles.failureAssumptions} aria-labelledby="failure-assumptions-heading">
      <h3 id="failure-assumptions-heading">Where the failure assumptions come from</h3>
      <p>The assumed mix of outcomes is informed by maritime incident data, rather than measured Panthalassa fleet performance. Exact outcome probabilities, sources, and calculation details are provided in the appendix.</p>
    </aside>
  </section>;
}
