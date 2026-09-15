import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useModel } from "../hooks/useModel.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { SliderPanel } from "../components/SliderPanel.js";
import { SharedInputsPanel } from "../components/SharedInputsPanel.js";
import { ComparisonVerdict } from "../components/ComparisonVerdict.js";
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
  TerrestrialResults,
  buildTerrestrialInputs,
  runTerrestrialModel,
  type TerrestrialArchitectureInputs,
  type TerrestrialPowerSource,
} from "../../terrestrial/index.js";
import styles from "./OldDashboard.module.css";

export function OldDashboard() {
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

  const compact = useMediaQuery("(max-width: 1055px)");

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <h1 className={styles.title}>Panthalassa Wave-Powered Data-Center Model</h1>
        <p className={styles.subtitle}>Analytical techno-economic dashboard</p>
        <Link to="/" className={styles.homeLink}>
          Home
        </Link>
      </header>

      <div className={styles.layout}>
        {!compact && (
          <aside className={styles.sidebar}>
            <SliderPanel inputs={inputs} setInput={setInput} resetAll={resetAll} />
          </aside>
        )}

        <main className={styles.main}>
          {compact && (
            <div className={styles.inputsDock}>
              <details className={styles.dockCard}>
                <summary className={styles.dockSummary}>
                  Panthalassa inputs
                  <svg
                    className={styles.dockChevron}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 2.5 7.5 6 4 9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <SliderPanel inputs={inputs} setInput={setInput} resetAll={resetAll} />
              </details>
              <details className={styles.dockCard}>
                <summary className={styles.dockSummary}>
                  Terrestrial inputs
                  <svg
                    className={styles.dockChevron}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 2.5 7.5 6 4 9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <TerrestrialControls
                  inputs={terrestrialInputs}
                  onChange={setTerrestrialInput}
                  onSelectPowerSource={setPowerSource}
                  onReset={resetTerrestrial}
                />
              </details>
            </div>
          )}

          <SharedInputsPanel inputs={inputs} setInput={setInput} />

          <ComparisonVerdict oceanResult={result} terrestrialResult={terrestrialResult} />

          <ArchitectureComparison oceanResult={result} terrestrialResult={terrestrialResult} />
          <CostPerWattBreakdown oceanResult={result} terrestrialResult={terrestrialResult} />

          {/* Below the shared comparison, each architecture gets its own column under a
              side-coloured head: Cod Gray for the ocean fleet, Timberwolf for the terrestrial
              plant. Everything in a column belongs to that side. */}
          <div className={styles.sides}>
            <section className={styles.side} aria-labelledby="ocean-side">
              <h2 id="ocean-side" className={`${styles.sideHead} ${styles.sideOcean}`}>
                Panthalassa
              </h2>
              <CostBreakdown result={result} />
              <BaselineComparison result={result} />
              <ResultsHeader result={result} isPending={isPending} />
            </section>
            <section className={styles.side} aria-labelledby="land-side">
              <h2 id="land-side" className={`${styles.sideHead} ${styles.sideLand}`}>
                Terrestrial
              </h2>
              <TerrestrialResults result={terrestrialResult} />
              <TerrestrialBaselineComparison result={terrestrialResult} />
              <TerrestrialDiagnostics result={terrestrialResult} />
            </section>
          </div>
        </main>

        {!compact && (
          <aside className={styles.terrestrialSidebar}>
            <TerrestrialControls
              inputs={terrestrialInputs}
              onChange={setTerrestrialInput}
              onSelectPowerSource={setPowerSource}
              onReset={resetTerrestrial}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
