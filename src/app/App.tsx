import { useModel } from "./hooks/useModel.js";
import { SliderPanel } from "./components/SliderPanel.js";
import { TotalOutputBand } from "./components/TotalOutputBand.js";
import { ResultsHeader } from "./components/ResultsHeader.js";
import { CostBreakdown } from "./components/CostBreakdown.js";
import styles from "./App.module.css";

export function App() {
  const { inputs, setInput, resetAll, result, isPending } = useModel();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.title}>Panthalassa Wave-Powered Data-Center Model</span>
        <span className={styles.subtitle}>Analytical techno-economic dashboard</span>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <SliderPanel inputs={inputs} setInput={setInput} resetAll={resetAll} />
        </aside>

        <main className={styles.main}>
          <TotalOutputBand result={result} />
          <ResultsHeader result={result} isPending={isPending} />
          <CostBreakdown result={result} />
        </main>
      </div>
    </div>
  );
}
