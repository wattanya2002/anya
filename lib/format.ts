const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatInt = (n: number) => intFmt.format(n);
export const formatBahtFromSatang = (satang: number) => `฿${intFmt.format(Math.round(satang / 100))}`;
export const formatPct = (n: number | null) => (n === null ? "N/A" : `${oneDp.format(n)}%`);

export function formatDelta(n: number | null, unit: "pct" | "pt"): string {
  if (n === null) return "N/A";
  if (Math.abs(n) < 0.05) return `0.0${unit === "pct" ? "%" : " จุด"}`;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${oneDp.format(Math.abs(n))}${unit === "pct" ? "%" : " จุด"}`;
}

export function formatThaiDateTime(d: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);
}
