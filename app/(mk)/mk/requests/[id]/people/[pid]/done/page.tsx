import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { getRequest, mkViewer } from "@/lib/mk";
import { baht, thaiStamp } from "@/lib/mk-core";
import { StatusPill } from "@/components/mk/ui";

export const metadata = { title: "อนุมัติอินฟลูเอนเซอร์แล้ว · MK" };

export default async function PersonDonePage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const user = await mkViewer();
  const r = await getRequest(user, id);
  const p = r?.people.find((x) => x.id === pid);
  if (!r || !p) notFound();
  const next = r.people.find((x) => x.status === "pending");
  return (
    <div className="ap" data-tone="white">
      <div className="ap-page">
        <div className="ap-col">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href={`/mk/requests/${r.id}`} className="ap-ibtn surf" aria-label="ปิดและกลับไปที่คำขอ"><X aria-hidden="true" strokeWidth={1.8} /></Link>
          </div>
          <div className="ap-success" role="status">
            <span className="ap-check"><Check aria-hidden="true" /></span>
            <h1>{p.status === "approved" ? "อนุมัติแล้ว" : "ยังไม่ได้อนุมัติ"}</h1>
            <p>{p.name}</p>
            {p.feeSatang !== null && <b>{baht(p.feeSatang)}</b>}
          </div>
          <dl className="ap-dl right" style={{ marginTop: 28, padding: "4px 18px", borderRadius: 24 }}>
            <div><dt>สถานะ</dt><dd><StatusPill status={p.status === "approved" ? "approved" : "pending"} /></dd></div>
            <div><dt>ผู้อนุมัติ</dt><dd>{p.decidedByName ?? "—"}</dd></div>
            <div><dt>เวลา</dt><dd>{p.decidedAt ? thaiStamp(p.decidedAt) : "—"}</dd></div>
            <div><dt>คำขอ</dt><dd>{r.status === "approved" ? "อนุมัติครบทุกคนแล้ว" : `รออีก ${r.people.filter((x) => x.status === "pending").length} คน`}</dd></div>
          </dl>
          <div className="ap-spacer" />
          {next
            ? <Link href={`/mk/requests/${r.id}/people/${next.id}`} className="ap-btn primary block h56">ดูคนถัดไป · {next.name}</Link>
            : <Link href="/mk" className="ap-btn primary block h56">กลับหน้ารวมคำขอ</Link>}
          <Link href={`/mk/requests/${r.id}`} className="ap-btn ghost block h48" style={{ marginTop: 6 }}>ดูคำขอนี้</Link>
        </div>
      </div>
    </div>
  );
}
