import { useEffect, useId, useRef, useState } from 'react';
import { SEA, seaBatteryProfile, travelBatteryPower } from './chartData.js';
import type { VisualState } from './storyData.js';
import styles from './Methodology.module.css';

type Point = [number, number];
export function PowerChart({ state, active = true, still = false }: {state: VisualState; active?: boolean; still?: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width,setWidth] = useState(540);
  useEffect(() => { const ro = new ResizeObserver(e => setWidth(Math.max(280,e[0]!.contentRect.width))); if(ref.current) ro.observe(ref.current); return()=>ro.disconnect(); },[]);
  const [waveMix, setWaveMix] = useState(0);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setWaveMix(0);
    if (state !== 'resource' || !active || still || reduced || !ref.current) return;
    let frame = 0, inView = false, startedAt = 0;
    const holdMs = 1600, transitionMs = 400;
    const halfCycle = holdMs + transitionMs;
    const tick = (now: number) => {
      const phase = (now - startedAt) % (2 * halfCycle);
      const rising = phase < halfCycle;
      const elapsed = rising ? phase : phase - halfCycle;
      const t = Math.max(0, Math.min(1, (elapsed - holdMs) / transitionMs));
      const smooth = t * t * (3 - 2 * t);
      setWaveMix(rising ? smooth : 1 - smooth);
      frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      setWaveMix(0);
      if (inView && !document.hidden) {
        startedAt = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (visible !== inView) { inView = visible; restart(); }
    }, { root: ref.current.closest('[data-prototype-scroll]'), threshold: 0 });
    observer.observe(ref.current);
    document.addEventListener('visibilitychange', restart);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', restart);
    };
  }, [state, active, still, reduced]);
  const uid = useId().replace(/:/g,'');
  const mix = state === 'battery' || (state === 'resource' && (still || reduced)) ? 1 : state === 'resource' && active ? waveMix : 0;
  const variable = mix >= .5;
  const capped = state !== 'resource'; const battery = state === 'battery';
  const left = 38, right = width-12, top=66, bottom=320, span=right-left;
  const x = (fraction:number) => left+fraction*span;
  const y = (power:number) => bottom-power/660*(bottom-top);
  const resource: Point[] = [[0,0],[.11,215],[.26,537], ...SEA.map(([t,p]):Point => [.26+t/36*.40,537 + mix * (p-537)]), [.81,215],[.92,0],[1,0]];
  const compute: Point[] = [[0,0],[.11*200/215,200],[.11,200],[.26,200], ...(variable ? SEA.map(([t,p]):Point => [.26+t/36*.4,Math.min(p,200)]) : [[.66,200] as Point]),[.81,200],[.81+.11*(1-200/215),200],[.92,0],[1,0]];
  const supported: Point[] = [...Array.from({length:151},(_,i):Point => [.11*i/150,travelBatteryPower(i/150,true)]),[.26,200],...seaBatteryProfile().map(([t,p]):Point=>[.26+t/36*.4,p]),[.81,200],...Array.from({length:151},(_,i):Point=>[.81+.11*i/150,travelBatteryPower(i/150,false)]),[.92,0],[1,0]];
  const line = (pts:Point[]) => pts.map(([a,b],i)=>`${i?'L':'M'}${x(a).toFixed(2)},${y(b).toFixed(2)}`).join(' ');
  const fill = (pts:Point[]) => `${line(pts)} L${right},${bottom} L${left},${bottom} Z`;
  const stages = [{a:0,b:.11,lines:['Tug','out']},{a:.11,b:.26,lines:['Travel','out']},{a:.26,b:.66,lines:['Sea','park']},{a:.66,b:.81,lines:['Travel','back']},{a:.81,b:.92,lines:['Tug','in']},{a:.92,b:1,lines:['Mainte-','nance']}];
  return <div ref={ref} className={styles.chart}>
    <div className={styles.chartHeading}><span>ONE OPERATING CYCLE</span><span>{battery ? '03 / Add battery support' : capped ? '02 / Apply the computing limit' : '01 / Available wave resource'}</span></div>
    <svg width="100%" viewBox={`0 0 ${width} 396`} role="img" aria-label={battery ? 'Battery support fills a 60 kilowatt-hour lull and partly fills a 360 kilowatt-hour lull. The shaded area represents energy supplied to computing.' : capped ? 'The 200 kilowatt computing limit is reached before outbound tugging ends, below the 300 kilowatt generator limit.' : 'Illustrative wave-derived power rises during travel, fluctuates at the sea park, and falls to zero in port.'}>
      <defs><linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9dddc9" stopOpacity=".22"/><stop offset="1" stopColor="#9dddc9" stopOpacity=".03"/></linearGradient></defs>
      <text x={left} y="32" fill="#a5bece" fontSize="11">Power (kW)</text>
      {[0,200,400,600].map(v=><g key={v}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#567386" strokeOpacity=".28"/><text x={left-8} y={y(v)+4} textAnchor="end" fill="#9fb4c2" fontSize="11">{v}</text></g>)}
      {stages.map((s,i)=><g key={i}><line x1={x(s.a)} x2={x(s.a)} y1={top} y2={bottom} stroke="#567386" strokeOpacity=".2"/><text x={x((s.a+s.b)/2)} y="345" textAnchor="middle" fill="#aec3d0" fontSize="11"><tspan x={x((s.a+s.b)/2)}>{s.lines[0]}</tspan><tspan x={x((s.a+s.b)/2)} dy="14">{s.lines[1]}</tspan></text></g>)}
      {battery && <path d={fill(supported)} fill={`url(#${uid}-fill)`}/>}
      <path d={line(resource)} fill="none" stroke="#8ba9bd" strokeWidth="1.7" opacity={capped ? .46 : .9} strokeLinejoin="round"/>
      {capped && <>
        <line x1={left} x2={right} y1={y(300)} y2={y(300)} stroke="#7c91a0" strokeDasharray="2 6" opacity=".65"/>
        <text x={right} y={y(300)-8} textAnchor="end" fill="#9bb0bf" fontSize="11">300 kW · generating limit</text>
        <line x1={left} x2={right} y1={y(200)} y2={y(200)} stroke="#c5d9df" strokeDasharray="3 5"/>
        <path d={line(compute)} fill="none" stroke="#a9e4d2" strokeWidth="2.5" strokeLinejoin="round"/>
        <text x={right} y={y(200)-9} textAnchor="end" fill="#d4e8e5" fontSize="11">200 kW · computing capacity</text>
      </>}
      {state==='capacity' && <g><circle cx={x(.11*200/215)} cy={y(200)} r="4" fill="#d7f8eb"/><path d={`M${x(.11*200/215)},${y(200)-9} L${x(.11*200/215)},${y(420)} L${x(.15)},${y(450)}`} fill="none" stroke="#93bdb2" strokeWidth=".8"/><text x={x(.16)} y={y(450)+3} fill="#d3e9e2" fontSize="11">Full computing power</text><text x={x(.16)} y={y(450)+18} fill="#a9c8c2" fontSize="11">before the tug handoff</text></g>}
      {battery && <>
        <path d={`${line(supported)} ${line([...compute].reverse()).replace('M','L')} Z`} fill="#e1bd77" opacity=".3"/>
        <path d={line(supported)} fill="none" stroke="#efd295" strokeWidth="2"/>
      </>}
      <text x={(left+right)/2} y="386" fill="#9fb4c2" fontSize="11" textAnchor="middle">Operating cycle</text>
    </svg>
    <div className={styles.legend}>
      <span><i className={styles.resourceKey}/>Wave-derived power before equipment limits</span>
      {capped && <span><i className={styles.computeKey}/>{battery ? 'Power Supplied to Compute sans battery' : 'Power supplied to computing · before batteries'}</span>}
      {battery && <span><i className={styles.batteryKey}/>Power Supplied to Compute with Battery</span>}
    </div>
    <p className={styles.chartCaption}>{variable ? 'Illustrative wave variability' : 'Simplified resource profile'} · stage durations not to scale</p>
    {battery && <div className={styles.chartFoot}>Shaded area: energy supplied to computing.<br/>Short lull fully bridged; deeper lull only partly bridged.</div>}
  </div>;
}
