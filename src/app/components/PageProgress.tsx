import { useEffect, useRef, useState } from "react";
import styles from "./PageProgress.module.css";

const chapters = [
  ["intro", "Intro"],
  ["methodology", "Explanation"],
  ["dashboard", "Dashboard"],
  ["takeaways", "Takeaways"],
  ["appendix", "Appendix"],
] as const;

export function PageProgress({ heroHorizon }: { heroHorizon: number }) {
  const nav = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ index: 0, fraction: 0, dark: false });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = chapters.map(([id]) => document.getElementById(id)?.getBoundingClientRect());
      if (bounds.some(bound => !bound)) return;
      const barHeight = nav.current?.getBoundingClientRect().height ?? 50;
      const anchor = barHeight + 15;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      let index = 0;
      bounds.forEach((bound, i) => { if (bound!.top <= anchor) index = i; });
      const atEnd = window.scrollY >= maxScroll - 2;
      if (atEnd) index = chapters.length - 1;
      const start = bounds[index]!.top;
      const end = bounds[index + 1]?.top ?? maxScroll - window.scrollY + anchor;
      const fraction = atEnd ? 1 : Math.max(0, Math.min(1, (anchor - start) / Math.max(1, end - start)));
      // Follow the surface behind the bar, including the hero's sky/ocean boundary.
      const middle = barHeight / 2;
      const hero = bounds[0]!;
      const dashboard = bounds[2]!;
      const overSky = hero.top <= middle && hero.top + hero.height * heroHorizon > middle;
      const overDashboard = dashboard.top <= middle && dashboard.bottom > middle;
      const dark = !overSky && !overDashboard;
      setPosition(previous => previous.index === index && previous.dark === dark &&
        Math.abs(previous.fraction - fraction) < 0.001 ? previous : { index, fraction, dark });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [heroHorizon]);

  return <nav ref={nav} className={`${styles.bar} ${position.dark ? styles.dark : ""}`} aria-label="Page sections">
    <ol className={styles.chapters}>{chapters.map(([id, label], index) => <li key={id}>
      <a href={`#${id}`} aria-current={index === position.index ? "location" : undefined}>
        <span>{label}</span>
        <span className={styles.track} aria-hidden="true"><span style={{
          transform: `scaleX(${index < position.index ? 1 : index === position.index ? position.fraction : 0})`,
        }} /></span>
      </a>
    </li>)}</ol>
  </nav>;
}
