import type { TerrestrialModelResult } from "../model/types.js";
import { formatUsdCompact } from "../../app/lib/formatters.js";
import bandStyles from "../../app/components/TotalOutputBand.module.css";

interface Props {
  result: TerrestrialModelResult;
}

/**
 * Reuses TotalOutputBand's CSS module for visual consistency, but with a
 * single figure, not a two-up split: nameplate capacity needs a whole
 * explanation to interpret sensibly across power sources (a
 * 25%-capacity-factor solar farm needs ~3.4x CCGT's nameplate to average
 * the same load; see docs/SOURCES_AND_ASSUMPTIONS.md), so it's relegated to
 * TerrestrialDiagnostics's "Generation margin over load" tile instead of
 * headlining here -- and present-value cost is already shown in
 * ArchitectureComparison, so it isn't repeated here either.
 */
export function TerrestrialOutputBand({ result }: Props) {
  return (
    <div className={`card ${bandStyles.accentCard}`}>
      <div className={bandStyles.eyebrowRow}>
        <span className={bandStyles.eyebrow}>Terrestrial</span>
      </div>
      <div className={bandStyles.wrap}>
        <div className={bandStyles.half}>
          <span className={bandStyles.label}>Total lifecycle cost</span>
          <span className={`${bandStyles.value} num`}>{formatUsdCompact(result.costs.total_lifecycle_cost_usd)}</span>
          <span className={bandStyles.sub}>Undiscounted, over the analysis period.</span>
        </div>
      </div>
    </div>
  );
}
