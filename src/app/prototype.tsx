// Standalone review entry; the deployed application continues to use main.tsx.
import { createRoot } from 'react-dom/client';
import { NodeWaveHero, HORIZON_FRAC } from './components/NodeWaveHero.js';
import { Methodology } from './components/methodology/Methodology.js';
import styles from './pages/WireframeHome.module.css';
import type { CSSProperties } from 'react';

const dashboard = 'https://panthalassa-dashboard.vercel.app/';
function Prototype() {
  return <div data-prototype-scroll style={{height:760,overflowY:'auto',overflowX:'hidden',position:'relative',background:'#112a40'}}>
    <div className={styles.page} style={{'--horizon':`${HORIZON_FRAC*100}%`,'--font-sans':'Inter,system-ui,sans-serif','--font-mono':'ui-monospace,monospace'} as CSSProperties}>
      <section className={styles.hero} style={{height:660,minHeight:660}}>
        <NodeWaveHero className={styles.canvas}/>
        <header className={styles.topbar}><span className={styles.brand}>Panthalassa</span><nav className={styles.nav}><a className={styles.navLink} href={dashboard} target="_blank" rel="noreferrer">Current website ↗</a></nav></header>
        <div className={styles.title}><span className={styles.eyebrow}>Ocean-2 node</span><h1 className={styles.headline}>Wave Power</h1></div>
        <div className={styles.copy}>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
          <a className={styles.cta} href="#methodology" onClick={e=>{e.preventDefault();document.getElementById('panthalassa-preview')?.querySelector('#methodology')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}}>Read the methodology <span aria-hidden="true">↓</span></a>
        </div>
      </section>
      <Methodology preview dashboardHref={dashboard}/>
    </div>
  </div>;
}
const container = document.getElementById('panthalassa-preview');
if (container) createRoot(container).render(<Prototype/>);
