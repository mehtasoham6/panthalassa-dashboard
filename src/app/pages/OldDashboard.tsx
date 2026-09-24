import { useEffect, useMemo, useRef, useState } from "react";
import { useModel } from "../hooks/useModel.js";
import { SliderPanel } from "../components/SliderPanel.js";
import { SharedInputsPanel } from "../components/SharedInputsPanel.js";
import { TotalOutputBand } from "../components/TotalOutputBand.js";
import { LcoeBand } from "../components/LcoeBand.js";
import { ResultsHeader } from "../components/ResultsHeader.js";
import { CostBreakdown } from "../components/CostBreakdown.js";
import { BaselineComparison } from "../components/BaselineComparison.js";
import { ArchitectureComparison } from "../components/ArchitectureComparison.js";
import { CostPerWattBreakdown } from "../components/CostPerWattBreakdown.js";
import {
  DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  TERRESTRIAL_POWER_SOURCE_SPECS,
  TerrestrialBaselineComparison,
  TerrestrialControls,
  TerrestrialDiagnostics,
  TerrestrialOutputBand,
  TerrestrialLcoeBand,
  TerrestrialResults,
  buildTerrestrialInputs,
  runTerrestrialModel,
  type TerrestrialArchitectureInputs,
  type TerrestrialPowerSource,
} from "../../terrestrial/index.js";
import styles from "./OldDashboard.module.css";

export function OldDashboard() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [compactControls, setCompactControls] = useState(false);
  useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompactControls(entry.contentRect.width <= 680);
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);
  const { inputs, setInput, resetAll, result, isPending } = useModel();

  const [terrestrialInputs, setTerrestrialInputs] = useState<TerrestrialArchitectureInputs>(
    DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS,
  );
  const setTerrestrialInput = (key: keyof TerrestrialArchitectureInputs, value: number) =>
    setTerrestrialInputs((previous) => ({ ...previous, [key]: value }));
  const resetTerrestrial = () => setTerrestrialInputs(DEFAULT_TERRESTRIAL_ARCHITECTURE_INPUTS);
  // Switching power source resets only that technology's own sliders to its
  // defaults (see TERRESTRIAL_POWER_SOURCE_SPECS) -- power-source-independent
  // sliders (discount rate, PUE, facility capex, chip failure rate) carry over.
  const setPowerSource = (source: TerrestrialPowerSource) =>
    setTerrestrialInputs((previous) => ({
      ...previous,
      power_source: source,
      ...TERRESTRIAL_POWER_SOURCE_SPECS[source].defaults,
    }));

  const terrestrialResult = useMemo(
    () => runTerrestrialModel(buildTerrestrialInputs(inputs, terrestrialInputs)),
    [inputs, terrestrialInputs],
  );

  const costDifferencePercent =
    100 * (1 - result.costs.total_node_fleet_cost_usd / terrestrialResult.costs.total_lifecycle_cost_usd);
  const roundedDifference = Math.abs(costDifferencePercent).toFixed(1);

  return (
    <div className={styles.shell} ref={shellRef}>
      <header className={styles.topbar}>
        <h2 className={styles.title}>The Interactive Model</h2>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <SliderPanel inputs={inputs} setInput={setInput} resetAll={resetAll} collapsible={compactControls} />
        </aside>

        <aside className={styles.terrestrialSidebar}>
          <TerrestrialControls
            inputs={terrestrialInputs}
            onChange={setTerrestrialInput}
            onSelectPowerSource={setPowerSource}
            onReset={resetTerrestrial}
            collapsible={compactControls}
          />
        </aside>

        <main className={styles.main}>
          <SharedInputsPanel inputs={inputs} setInput={setInput} />

          <div className={styles.compareRow}>
            <TotalOutputBand result={result} />
            <TerrestrialOutputBand result={terrestrialResult} />
          </div>

          <div
            className={`${styles.costComparison} ${costDifferencePercent < 0 ? styles.costPremium : ""}`}
            aria-live="polite"
          >
            {roundedDifference === "0.0" ? "Same cost as terrestrial" : <>
              <strong className="num">{roundedDifference}%</strong>
              <span>{costDifferencePercent > 0 ? "less" : "more"} than terrestrial</span>
            </>}
          </div>

          <div className={styles.compareRow}>
            <CostBreakdown result={result} />
            <TerrestrialResults result={terrestrialResult} />
          </div>

          <div className={styles.compareRow}>
            <LcoeBand result={result} />
            <TerrestrialLcoeBand result={terrestrialResult} />
          </div>

          <ArchitectureComparison oceanResult={result} terrestrialResult={terrestrialResult} />
          <CostPerWattBreakdown oceanResult={result} terrestrialResult={terrestrialResult} />

          <div className={styles.compareRow}>
            <BaselineComparison result={result} />
            <TerrestrialBaselineComparison result={terrestrialResult} />

            <ResultsHeader result={result} isPending={isPending} />
            <TerrestrialDiagnostics result={terrestrialResult} />
          </div>
        </main>


      </div>
    </div>
  );
}
