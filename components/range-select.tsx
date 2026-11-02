"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export function RangeSelect({ value }: { value: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div className="range" aria-busy={pending}>
      <Calendar className="cal" aria-hidden="true" strokeWidth={1.8} />
      <label htmlFor="range" className="sr-only">ช่วงเวลา</label>
      <select
        id="range"
        value={String(value)}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("range", e.target.value);
          start(() => router.replace(`/?${next.toString()}`, { scroll: false }));
        }}
      >
        <option value="7">7 วันที่ผ่านมา</option>
        <option value="30">30 วันที่ผ่านมา</option>
        <option value="90">90 วันที่ผ่านมา</option>
      </select>
      <ChevronDown className="chev" aria-hidden="true" strokeWidth={1.8} />
    </div>
  );
}
