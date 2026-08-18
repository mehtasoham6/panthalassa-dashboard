import type { TerrestrialModelResult } from "../model/types.js";
import { formatUsdCompact } from "../../app/lib/formatters.js";
import bandStyles from "../../app/components/TotalOutputBand.module.css";

interface Props {
  result: TerrestrialModelResult;
}

function formatGw(mw: number): string {
  const gw = mw / 1_000;
  return `${gw.toFixed(gw < 1 ? 3 : 2)} GW`;
}

/** Mirrors TotalOutputBand's markup/styling exactly (same CSS module) so the two banners read as a matched pair. */
export function TerrestrialOutputBand({ result }: Props) {
  return (
    <div className="card">
      <div className={bandStyles.eyebrowRow}>
        <span className={bandStyles.eyebrow}>Terrestrial</span>
      </div>
      <div className={bandStyles.wrap}>
        <div className={bandStyles.half}>
          <span className={bandStyles.label}>CCGT nameplate</span>
          <span className={`${bandStyles.value} num`}>{formatGw(result.capacity.ccgt_nameplate_capacity_mw)}</span>
          <span className={bandStyles.sub}>
            Sized for {result.inputs.pue.toFixed(2)} PUE and {(result.inputs.power_system_availability * 100).toFixed(0)}%
            availability
          </span>
        </div>
        <div className={bandStyles.divider} />
        <div className={bandStyles.half}>
          <span className={bandStyles.label}>Total lifecycle cost</span>
          <span className={`${bandStyles.value} num`}>{formatUsdCompact(result.costs.total_lifecycle_cost_usd)}</span>
          <span className={bandStyles.sub}>Undiscounted, over the analysis period.</span>
        </div>
      </div>
    </div>
  );
}
