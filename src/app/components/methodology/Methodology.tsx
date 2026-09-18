import { useEffect, useRef, useState } from 'react';
import { STEPS, COSTS, type VisualState } from './storyData.js';
import { NodeScene } from './NodeScene.js';
import { SeaMap } from './SeaMap.js';
import { PowerChart } from './PowerChart.js';
import { FailureSection } from './FailureSection.js';
import styles from './Methodology.module.css';

function Visual({ state, active = true, still = false }: {state: VisualState; active?: boolean; still?: boolean}) {
  const chart = ['resource','capacity','battery'].includes(state);
  const node = state === 'node' || state === 'waves';
  return <div className={`${styles.visual} ${chart ? styles.wideVisual : ''}`}>
    {chart ? <PowerChart key={state} state={state} active={active} still={still}/> : <>
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
  const [active,setActive] = useState(0);
  const [compact,setCompact] = useState(false);
  const [reduced,setReduced] = useState(false);

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
      setActive(index);
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
      {!inline && <aside className={styles.stickyVisual} aria-label="Illustration accompanying the current explanation"><Visual state={STEPS[active]!.visual}/></aside>}
      <div className={styles.copyColumn}>
        {STEPS.map((step,index)=><article key={step.id} id={step.id} data-story-step={index} className={styles.step}>
          <span className={styles.eyebrow}>{step.chapter}</span>
          <h3>{step.title}</h3>
          <div className={styles.paragraphs}>{step.paragraphs.map(p=><p key={p.slice(0,24)}>{p}</p>)}</div>
          {inline && <Visual state={step.visual} active={index === active} still={reduced}/>}
          {step.note && <aside className={styles.note}><h4>What about corrosion and marine growth?</h4><p>{step.note}</p></aside>}
        </article>)}
      </div>
    </div>
    <FailureSection />
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
