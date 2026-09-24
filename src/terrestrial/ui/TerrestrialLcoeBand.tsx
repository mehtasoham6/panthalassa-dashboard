import type { TerrestrialModelResult } from "../model/types.js";
import { formatUsdPerUnit } from "../../app/lib/formatters.js";
import bandStyles from "../../app/components/TotalOutputBand.module.css";

interface Props {
  result: TerrestrialModelResult;
}

/** Reuses TotalOutputBand's CSS module for visual consistency; sits in its own row below the total-lifecycle-cost cards. */
export function TerrestrialLcoeBand({ result }: Props) {
  return (
    <div className={`card ${bandStyles.accentCard}`}>
      <div className={bandStyles.eyebrowRow}>
        <span className={bandStyles.eyebrow}>Land-based</span>
      </div>
      <div className={bandStyles.wrap}>
        <div className={bandStyles.half}>
          <span className={bandStyles.label}>Power-system LCOE</span>
          <span className={`${bandStyles.value} num`}>{formatUsdPerUnit(result.lcoe.lcoe_usd_per_mwh, 2)}/MWh</span>
          <span className={bandStyles.sub}>Generation-only, over the power system's economic life.</span>
        </div>
      </div>
    </div>
  );
}
