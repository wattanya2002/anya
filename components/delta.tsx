import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatDelta } from "@/lib/format";

export function Delta({ value, unit }: { value: number | null; unit: "pct" | "pt" }) {
  if (value === null) {
    return <span className="delta na" title="ไม่มีข้อมูลช่วงก่อนหน้าให้เปรียบเทียบ">N/A</span>;
  }
  const dir = Math.abs(value) < 0.05 ? "flat" : value > 0 ? "up" : "down";
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  return (
    <span className={`delta ${dir === "up" ? "" : dir}`}>
      <Icon aria-hidden="true" />
      {formatDelta(value, unit)}
    </span>
  );
}
