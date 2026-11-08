import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronRight, Megaphone, Tag } from "lucide-react";
import { can } from "@/lib/auth";
import { getRequest, mkViewer } from "@/lib/mk";
import { KIND_LABEL, baht, refLabel, thaiRange } from "@/lib/mk-core";
import { diffDays } from "@/lib/calendar-core";
import { Tile } from "@/components/mk/ui";
import { ConfirmApprove } from "@/components/mk/decision-forms";

export const metadata = { title: "ยืนยันการอนุมัติ · MK" };

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await mkViewer();
  const r = await getRequest(user, id);
  if (!r) notFound();
  if (r.status !== "pending" || r.kind === "influencer" || !can(user, "approvals.decide")) redirect(`/mk/requests/${id}`);
  const back = `/mk/requests/${id}`;
  const end = r.endsOn ?? r.startsOn;
  const rows = [
    r.channel ? { icon: <Megaphone aria-hidden="true" />, k: "ช่องทาง", v: r.channel } : null,
    r.startsOn && end ? { icon: <CalendarDays aria-hidden="true" />, k: "ระยะเวลา", v: `${thaiRange(r.startsOn, end)} · ${diffDays(r.startsOn, end) + 1} วัน` } : null,
    r.kind === "promotion" && r.discountText ? { icon: <Tag aria-hidden="true" />, k: "ส่วนลด", v: r.discountText } : null,
  ].filter((x) => x !== null);
  const big = r.amountSatang !== null ? { l: r.kind === "ad" ? "งบที่ขออนุมัติ" : "งบประมาณ", v: baht(r.amountSatang) }
    : r.discountText ? { l: "ส่วนลด", v: r.discountText } : null;
  return (
    <div className="ap" data-tone="white">
      <div className="ap-page">
        <div className="ap-col">
          <div className="ap-page-head">
            <Link href={back} className="ap-ibtn surf" aria-label="กลับไปดูรายละเอียด"><ArrowLeft aria-hidden="true" strokeWidth={1.8} /></Link>
            <h1>ยืนยันการอนุมัติ</h1>
          </div>
          <div className="ap-ctile first"><Tile kind={r.kind} size={52} /><span style={{ minWidth: 0 }}><small>ขออนุมัติ{KIND_LABEL[r.kind]} · {refLabel(r.refNo)}</small><b>{r.title}</b></span></div>
          {rows.map((x) => <div key={x.k} className="ap-ctile"><span>{x.icon}</span><span style={{ minWidth: 0 }}><small>{x.k}</small><b>{x.v}</b></span></div>)}
          {big && <div className="ap-big"><small>{big.l}</small><b>{big.v}</b><span>ส่งโดย {r.submitterName}</span></div>}
          <Link href={back} className="ap-rowlink">ดูรายละเอียดคำขอ<ChevronRight aria-hidden="true" /></Link>
          <div className="ap-spacer" />
          <p className="ap-fine">เมื่อยืนยันแล้ว ระบบบันทึกชื่อผู้อนุมัติพร้อมเวลา<br />และแจ้งทีมที่ส่งคำขอทันที</p>
          <ConfirmApprove requestId={r.id} />
          <Link href={back} className="ap-btn ghost block h48" style={{ marginTop: 6 }}>กลับไปดูรายละเอียด</Link>
        </div>
      </div>
    </div>
  );
}
