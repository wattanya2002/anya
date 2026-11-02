import type { StockStatus } from "@/lib/inventory";
const LABEL: Record<StockStatus, string> = { out: "หมด", low: "ใกล้หมด", ok: "ปกติ" };
export function StockBadge({ status }: { status: StockStatus }) {
  return <span className={`stock-badge ${status}`}>{LABEL[status]}</span>;
}
