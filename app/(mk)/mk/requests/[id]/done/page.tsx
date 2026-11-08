import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { getRequest, mkViewer } from "@/lib/mk";
import { baht, thaiStamp } from "@/lib/mk-core";
import { StatusPill } from "@/components/mk/ui";

export const metadata = { title: "อนุมัติแล้ว · MK" };

export default async function DonePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await mkViewer();
  const r = await getRequest(user, id);
  if (!r) notFound();
  const approved = r.status === "approved";
  const self = r.decidedByName && r.decidedAt && r.events.some((e) => e.kind === "approved" && e.actorId === user.id);
  return (
    <div className="ap" data-tone="white">
      <div className="ap-page">
        <div className="ap-col">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/mk" className="ap-ibtn surf" aria-label="ปิดและกลับหน้ารวมคำขอ"><X aria-hidden="true" strokeWidth={1.8} /></Link>
          </div>
          <div className="ap-success" role="status">
            <span className="ap-check"><Check aria-hidden="true" /></span>
            <h1>{approved ? (sp.already && !self ? "คำขอนี้อนุมัติไปแล้ว" : "อนุมัติแล้ว") : "บันทึกแล้ว"}</h1>
            <p>{r.title}</p>
            {r.amountSatang !== null && <b>{baht(r.amountSatang)}</b>}
          </div>
          <dl className="ap-dl right" style={{ marginTop: 28, padding: "4px 18px", borderRadius: 24 }}>
            <div><dt>สถานะ</dt><dd><StatusPill status={r.status} /></dd></div>
            <div><dt>ผู้อนุมัติ</dt><dd>{r.decidedByName ?? "—"}{self ? " (คุณ)" : ""}</dd></div>
            <div><dt>เวลา</dt><dd>{r.decidedAt ? thaiStamp(r.decidedAt) : "—"}</dd></div>
            <div><dt>แจ้งทีม</dt><dd>{r.submittedBy === user.id ? "คำขอของคุณเอง" : `ส่งถึง${r.submitterName}แล้ว`}</dd></div>
          </dl>
          <div className="ap-spacer" />
          <Link href="/mk" className="ap-btn primary block h56">กลับหน้ารวมคำขอ</Link>
          <Link href={`/mk/requests/${r.id}`} className="ap-btn ghost block h48" style={{ marginTop: 6 }}>ดูคำขอนี้</Link>
        </div>
      </div>
    </div>
  );
}
