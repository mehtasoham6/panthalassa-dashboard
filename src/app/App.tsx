import { useMemo, useState } from "react";
import { useModel } from "./hooks/useModel.js";
import { SliderPanel } from "./components/SliderPanel.js";
import { SharedInputsPanel } from "./components/SharedInputsPanel.js";
import { TotalOutputBand } from "./components/TotalOutputBand.js";
import { ResultsHeader } from "./components/ResultsHeader.js";
import { CostBreakdown } from "./components/CostBreakdown.js";
import { BaselineComparison } from "./components/BaselineComparison.js";
import { ArchitectureComparison } from "./components/ArchitectureComparison.js";
import {
  DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  TerrestrialBaselineComparison,
  TerrestrialControls,
  TerrestrialDiagnostics,
  TerrestrialOutputBand,
  TerrestrialResults,
  buildTerrestrialInputs,
  runTerrestrialModel,
  type TerrestrialArchitectureInputs,
} from "../terrestrial/index.js";
import styles from "./App.module.css";

export function App() {
  const { inputs, setInput, resetAll, result, isPending } = useModel();

  const [terrestrialInputs, setTerrestrialInputs] = useState<TerrestrialArchitectureInputs>(
    DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  );
  const setTerrestrialInput = (key: keyof TerrestrialArchitectureInputs, value: number) =>
    setTerrestrialInputs((previous) => ({ ...previous, [key]: value }));
  const resetTerrestrial = () => setTerrestrialInputs(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS);

  const terrestrialResult = useMemo(
    () => runTerrestrialModel(buildTerrestrialInputs(inputs, terrestrialInputs)),
    [inputs, terrestrialInputs],
  );

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
          <SharedInputsPanel inputs={inputs} setInput={setInput} />

          <div className={styles.compareRow}>
            <TotalOutputBand result={result} />
            <TerrestrialOutputBand result={terrestrialResult} />
          </div>

          <ArchitectureComparison oceanResult={result} terrestrialResult={terrestrialResult} />

          <div className={styles.compareRow}>
            <BaselineComparison result={result} />
            <TerrestrialBaselineComparison result={terrestrialResult} />

            <ResultsHeader result={result} isPending={isPending} />
            <TerrestrialDiagnostics result={terrestrialResult} />

            <CostBreakdown result={result} />
            <TerrestrialResults result={terrestrialResult} />
          </div>
        </main>

        <aside className={styles.terrestrialSidebar}>
          <TerrestrialControls inputs={terrestrialInputs} onChange={setTerrestrialInput} onReset={resetTerrestrial} />
        </aside>
      </div>
    </div>
  );
}
