"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS_SUN, monthCells, monthLong, shiftMonth, thaiRange, thaiShort } from "@/lib/mk-core";
import { addDays, diffDays } from "@/lib/calendar-core";

/** Date-range filter on the decide-by date. Tap a start day, then an end day; the range may cross weeks and months (canvas 04b). */
export function RangePicker({ today, initial, keep }: { today: string; initial: { from: string; to: string } | null; keep: Record<string, string> }) {
  const router = useRouter();
  const [from, setFrom] = useState<string | null>(initial?.from ?? null);
  const [to, setTo] = useState<string | null>(initial?.to ?? null);
  const [month, setMonth] = useState(`${(initial?.from ?? today).slice(0, 7)}-01`);
  const weeks = useMemo(() => monthCells(month), [month]);
  const pick = (d: string) => {
    if (!from || (from && to)) { setFrom(d); setTo(null); return; }
    if (d < from) { setTo(from); setFrom(d); return; }
    setTo(d);
  };
  const end = to ?? from;
  const qs = (extra: Record<string, string>) => {
    const s = new URLSearchParams({ ...keep, ...extra }).toString();
    return s ? `/mk?${s}` : "/mk";
  };
  const apply = () => { if (from) router.push(qs({ from, to: end ?? from })); };
  const presets: { label: string; f: string; t: string }[] = [
    { label: "7 วันข้างหน้า", f: today, t: addDays(today, 6) },
    { label: "30 วันข้างหน้า", f: today, t: addDays(today, 29) },
  ];
  return (
    <div className="ap-page" style={{ background: "#f2f4f8" }}>
      <div className="ap-col">
        <div className="ap-page-head">
          <Link href={qs({})} className="ap-ibtn white" aria-label="กลับไปหน้ารวมคำขอ"><ArrowLeft aria-hidden="true" strokeWidth={1.8} /></Link>
          <h1 style={{ fontSize: 19 }}>กรองตามกำหนดตัดสินใจ</h1>
        </div>
        <section className="ap-card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>ช่วงที่เลือก</div>
          <div className="ap-rangebtn" role="status" aria-live="polite">
            <span>{from ? (to ? thaiRange(from, to) : `${thaiShort(from, true)} – เลือกวันสิ้นสุด`) : "แตะวันเริ่มในปฏิทิน"}</span><CalendarDays aria-hidden="true" />
          </div>
          <div className="ap-note" style={{ marginTop: 8, fontSize: 13 }}>
            {from && end ? `${diffDays(from, end) + 1} วัน` : "เลือกวันเริ่ม แล้วเลือกวันสิ้นสุด (ข้ามสัปดาห์หรือข้ามเดือนได้)"}
          </div>
          <div className="ap-quick" style={{ marginTop: 10 }}>
            {presets.map((p) => <button key={p.label} type="button" onClick={() => { setFrom(p.f); setTo(p.t); setMonth(`${p.f.slice(0, 7)}-01`); }}>{p.label}</button>)}
          </div>
        </section>
        <section className="ap-card tight" style={{ marginTop: 12 }}>
          <div className="ap-mhead">
            <h2>{monthLong(month)}</h2>
            <div className="ap-mnav">
              <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="เดือนก่อนหน้า"><ChevronLeft aria-hidden="true" /></button>
              <i aria-hidden="true" />
              <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="เดือนถัดไป"><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
          <div className="ap-wd" aria-hidden="true">{WEEKDAYS_SUN.map((d) => <span key={d}>{d}</span>)}</div>
          {weeks.map((wk, wi) => {
            const inrow = from && end ? wk.map((d, i) => (d && d >= from && d <= end ? i : -1)).filter((i) => i >= 0) : [];
            return (
              <div key={wi} className="ap-week r50">
                {inrow.length > 0 && <span className="ap-band" aria-hidden="true" style={{ left: `calc(${inrow[0]} * 100% / 7 + 3px)`, width: `calc(${inrow[inrow.length - 1] - inrow[0] + 1} * 100% / 7 - 6px)` }} />}
                {wk.map((d, ci) => d ? (
                  <span key={d}>
                    <button type="button" className={`ap-day${d === today ? " today" : ""}`} style={{ height: 50 }} onClick={() => pick(d)}
                      aria-pressed={d === from || d === end ? "true" : "false"} aria-label={`${thaiShort(d, true)}${d === today ? " วันนี้" : ""}`}>
                      <span className="ap-dnum">{Number(d.slice(8, 10))}</span>
                    </button>
                  </span>
                ) : <span key={ci} />)}
              </div>
            );
          })}
        </section>
        <div className="ap-spacer" />
        <div className="ap-stack" style={{ gap: 10, marginTop: 20 }}>
          <button type="button" className="ap-btn primary block h56" disabled={!from} onClick={apply}>ใช้ตัวกรอง</button>
          <Link href={qs({})} className="ap-btn outline block">ล้างช่วงวันที่</Link>
        </div>
      </div>
    </div>
  );
}

