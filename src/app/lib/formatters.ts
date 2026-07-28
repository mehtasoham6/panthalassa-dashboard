export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatUsd(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsdPerUnit(value: number, decimals = 2): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Adaptive kWh -> kWh/MWh/GWh/TWh formatting for energy quantities that can span many orders of magnitude. */
export function formatEnergyKwh(kwh: number, decimals = 1): string {
  const abs = Math.abs(kwh);
  if (abs >= 1e9) return `${(kwh / 1e9).toFixed(decimals)} TWh`;
  if (abs >= 1e6) return `${(kwh / 1e6).toFixed(decimals)} GWh`;
  if (abs >= 1e3) return `${(kwh / 1e3).toFixed(decimals)} MWh`;
  return `${kwh.toFixed(0)} kWh`;
}

/** Adaptive GB -> GB/TB/PB formatting for data-volume quantities. */
export function formatDataGb(gb: number, decimals = 1): string {
  const abs = Math.abs(gb);
  if (abs >= 1e6) return `${(gb / 1e6).toFixed(decimals)} PB`;
  if (abs >= 1e3) return `${(gb / 1e3).toFixed(decimals)} TB`;
  return `${gb.toFixed(0)} GB`;
}
