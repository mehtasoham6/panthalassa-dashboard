import { useEffect, useRef, useState } from 'react';
import { STEPS, FAILURES, COSTS, type VisualState } from './storyData.js';
import { NodeScene } from './NodeScene.js';
import { SeaMap } from './SeaMap.js';
import { PowerChart } from './PowerChart.js';
import styles from './Methodology.module.css';

function Visual({ state, progress = 1, still = false }: {state: VisualState; progress?: number; still?: boolean}) {
  const chart = ['resource','capacity','battery'].includes(state);
  const node = state === 'node' || state === 'waves';
  return <div className={`${styles.visual} ${chart ? styles.wideVisual : ''}`}>
    {chart ? <PowerChart state={state} progress={progress} still={still}/> : <>
      <div className={styles.circle}>
        <div className={styles.visualTransition} key={node ? 'node' : 'map'}>
          {node ? <NodeScene waves={state==='waves'} still={still}/> : <SeaMap state={state}/>}
        </div>
      </div>
      <div className={styles.visualCaption}>
        {node ? <><span>THE PHYSICAL NODE</span><span>Original Ocean-2 geometry</span></> : <><span>{state === 'geography' ? 'THE WAVE RESOURCE' : state === 'outbound' ? 'OUTBOUND JOURNEY' : 'RETURN & MAINTENANCE'}</span><span>{state === 'geography' ? 'Model reference location · Natural Earth basemap' : 'Illustrative route · model reference location'}</span></>}
      </div>
    </>}
  </div>;
}

export function Methodology({ dashboardHref = '/old', preview = false }: {dashboardHref?: string; preview?: boolean}) {
  const host = useRef<HTMLElement>(null);
  const failureRef = useRef<HTMLElement>(null);
  const [active,setActive] = useState(0);
  const [progress,setProgress] = useState(0);
  const [compact,setCompact] = useState(false);
  const [reduced,setReduced] = useState(false);
  const [failureReady,setFailureReady] = useState(false);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(e => setCompact(e[0]!.contentRect.width < 720)); ro.observe(el);
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches); update(); mq.addEventListener('change',update);
    return () => { ro.disconnect(); mq.removeEventListener('change',update); };
  },[]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const scroller = el.closest('[data-prototype-scroll]') as HTMLElement | null;
    const scrollTarget: HTMLElement | Window = scroller || window;
    let pending = 0;
    const update = () => {
      pending = 0;
      const bounds = scroller?.getBoundingClientRect();
      const top = bounds?.top || 0, height = scroller?.clientHeight || window.innerHeight;
      const anchor = top + height*.43;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-story-step]'));
      let index = 0;
      for (let i=0; i<nodes.length; i++) if(nodes[i]!.getBoundingClientRect().top <= anchor) index=i;
      const rect = nodes[index]?.getBoundingClientRect();
      setActive(index);
      setProgress(rect ? Math.max(0,Math.min(1,(anchor-rect.top)/Math.max(1,rect.height*.65))) : 0);
      const last = nodes.at(-1)?.getBoundingClientRect();
      setFailureReady(!last || last.bottom <= top+8);
    };
    const onScroll = () => { if(!pending) pending=requestAnimationFrame(update); };
    scrollTarget.addEventListener('scroll',onScroll,{passive:true}); window.addEventListener('resize',onScroll); update();
    return () => { scrollTarget.removeEventListener('scroll',onScroll); window.removeEventListener('resize',onScroll); cancelAnimationFrame(pending); };
  },[]);

  const inline = compact || reduced;
  return <section ref={host} className={styles.methodology} id="methodology" aria-labelledby="methodology-heading">
    <header className={styles.sectionHead}>
      <div><span className={styles.eyebrow}>THE METHODOLOGY</span><h2 id="methodology-heading">From ocean waves<br/>to a computing fleet.</h2></div>
      <div className={styles.headAside}><p>Follow the physical system.<br/>Then follow the calculation.</p><a href={dashboardHref}>Go straight to the dashboard <span aria-hidden="true">↗</span></a></div>
    </header>
    <div className={`${styles.story} ${inline ? styles.inlineStory : ''}`}>
      {!inline && <aside className={styles.stickyVisual} aria-label="Illustration accompanying the current explanation"><Visual state={STEPS[active]!.visual} progress={progress}/></aside>}
      <div className={styles.copyColumn}>
        {STEPS.map((step,index)=><article key={step.id} id={step.id} data-story-step={index} className={styles.step}>
          <span className={styles.eyebrow}>{step.chapter}</span>
          <h3>{step.title}</h3>
          <div className={styles.paragraphs}>{step.paragraphs.map(p=><p key={p.slice(0,24)}>{p}</p>)}</div>
          {inline && <Visual state={step.visual} progress={1} still={reduced}/>}
          {step.note && <aside className={styles.note}><h4>What about corrosion and marine growth?</h4><p>{step.note}</p></aside>}
        </article>)}
      </div>
    </div>
    <section ref={failureRef} id="failures" className={`${styles.failureSection} ${!failureReady && !reduced ? styles.failureWaiting : ''}`} aria-labelledby="failure-heading">
      <div className={styles.failureIntro}><span className={styles.eyebrow}>04 / Account for failures</span><h2 id="failure-heading">What actually gets delivered?</h2><p>The scheduled contribution assumes nothing unexpectedly breaks. The model accounts for chip failures separately, then estimates other losses by combining the overall node-failure rate, the probability of each outcome, and the computing contribution lost while the node is unavailable. Exact probabilities can be found in the appendix.</p></div>
      <div className={styles.failureBody}>
        <div className={styles.cardGrid}>{FAILURES.map(([title,body],i)=><article key={title} className={styles.failureCard}><span className={styles.cardNumber}>0{i+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <figure className={styles.equation} aria-label="Scheduled contribution minus chip-related losses minus other failure losses equals expected contribution"><figcaption>THE EXPECTED CONTRIBUTION</figcaption><div><span/>Scheduled contribution</div><div><span>−</span>Expected chip-related losses</div><div><span>−</span>Expected losses from other failures</div><div className={styles.equationResult}><span>=</span>Expected contribution</div><small>Each outcome weighted by its probability and lost output.</small></figure>
      </div>
      <p className={styles.sharedNote}>Failure assumptions are informed by public maritime incident data, rather than measured Panthalassa fleet performance. The node-failure slider changes the overall rate; the model keeps the assumed mix of outcomes fixed.</p>
    </section>
    <section className={styles.costSection} id="fleet-cost" aria-labelledby="cost-heading">
      <span className={styles.eyebrow}>05 / Scale the fleet & calculate cost</span><h2 id="cost-heading">One contribution.<br/>A fleet-sized calculation.</h2>
      <div className={styles.costIntro}><p>Once we know one node’s expected contribution, we calculate how many are needed to meet the selected computing target over the analysis period. This matches total expected energy supplied to computing, rather than guaranteeing the target at every moment.</p><p>Once we estimate how many nodes are needed, we multiply that fleet size by the cost of building and equipping each node. We then add the costs of operating, maintaining, and replacing equipment over the analysis period.</p></div>
      <div className={`${styles.cardGrid} ${styles.costGrid}`}>{COSTS.map(([title,body],i)=><article key={title}><span className={styles.cardNumber}>0{i+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      <p className={styles.sharedNote}>Specific cost assumptions, sources, and accounting details are provided in the appendix.</p>
    </section>
    <footer className={styles.end}><div><span className={styles.eyebrow}>EXPLORE THE ASSUMPTIONS</span><h2>Now, make the model yours.</h2></div><a href={dashboardHref}>Explore the dashboard <span aria-hidden="true">↗</span></a></footer>
    {preview && <p className={styles.previewFoot}>Local design preview · tour and appendix are not included in this prototype.</p>}
  </section>;
}
