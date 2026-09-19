import { COSTS } from './storyData.js';
import { FleetScene } from './FleetScene.js';
import styles from './Methodology.module.css';

export function CostSection() {
  return (
    <section className={styles.costSection} id="fleet-cost" aria-labelledby="cost-heading">
      <div className={styles.fleetIntro}>
      <FleetScene />
      <div className={styles.fleetCopy}>
      <h2 id="cost-heading">Now, make it fleet-sized.</h2>
      <div className={styles.costIntro}><p>Once we know one node’s expected contribution, we calculate how many nodes are needed to meet the selected computing target over the analysis period.</p><p>We then multiply that fleet size by the cost of building and equipping each node, and then add the costs of operating, maintaining, and replacing equipment over the analysis period. The costs broadly fall into the following buckets:</p></div>
      </div>
      </div>
      <dl className={styles.costRows}>{COSTS.map(([title,body])=><div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl>
      <p className={styles.costAppendix}>Specific cost assumptions, sources, and accounting details are provided in the appendix.</p>
    </section>
  );
}
