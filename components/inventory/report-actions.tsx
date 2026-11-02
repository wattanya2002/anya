"use client";
import { useState } from "react";
import { Copy, Download, MessageCircle, Printer } from "lucide-react";

export function ReportActions({ text, exportHref }: { text: string; exportHref: string }) {
  const [msg, setMsg] = useState("");
  const [manual, setManual] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMsg("คัดลอกแล้ว วางในแชทได้เลย"); setManual(false); }
    catch { setMsg("คัดลอกอัตโนมัติไม่ได้ — เลือกข้อความในกล่องด้านล่างแล้วคัดลอก"); setManual(true); }
  }
  return (
    <div className="report-actions">
      <button className="btn-pill primary" type="button" onClick={copy}><Copy aria-hidden="true" />คัดลอกข้อความ</button>
      <a className="btn-pill line" href={`https://line.me/R/share?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />ส่งเข้า LINE</a>
      <button className="btn-pill" type="button" onClick={() => window.print()}><Printer aria-hidden="true" />พิมพ์ / PDF</button>
      <a className="btn-pill" href={exportHref} download><Download aria-hidden="true" />ดาวน์โหลด Excel</a>
      <span className="muted small" role="status">{msg}</span>
      {manual && <textarea className="manual-copy" readOnly value={text} aria-label="ข้อความสรุปสำหรับคัดลอก" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
