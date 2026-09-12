// Consistent money & label formatting (PKR).

const nf = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** "Rs. 15,000" */
export function formatPKR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "Rs. 0";
  const sign = n < 0 ? "-" : "";
  return `${sign}Rs. ${nf.format(Math.abs(Math.round(n)))}`;
}

/** Compact money for tight spaces: "Rs. 1.5M", "Rs. 250K". */
export function formatPKRCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "Rs. 0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}Rs. ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}Rs. ${Math.round(abs / 1_000)}K`;
  return `${sign}Rs. ${abs}`;
}

/** Percentage with one decimal, e.g. "85.7%". */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "0%";
  return `${(ratio * 100).toFixed(1)}%`;
}
