import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronRight } from "lucide-react";
import { can } from "@/lib/auth";
import { getRequest, mkViewer } from "@/lib/mk";
import { baht, refLabel, thaiShort } from "@/lib/mk-core";
import { PlatformIcon, Tile } from "@/components/mk/ui";
import { ConfirmApprove } from "@/components/mk/decision-forms";

export const metadata = { title: "ยืนยันอนุมัติอินฟลูเอนเซอร์ · MK" };

export default async function ConfirmPersonPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const user = await mkViewer();
  const r = await getRequest(user, id);
  const p = r?.people.find((x) => x.id === pid);
  if (!r || !p) notFound();
  const back = `/mk/requests/${id}/people/${pid}`;
  if (r.status !== "pending" || p.status !== "pending" || !can(user, "approvals.decide")) redirect(back);
  const idx = r.people.indexOf(p);
  const left = r.people.filter((x) => x.status === "pending").length;
  return (
    <div className="ap" data-tone="white">
      <div className="ap-page">
        <div className="ap-col">
          <div className="ap-page-head">
            <Link href={back} className="ap-ibtn surf" aria-label="กลับไปดูรายละเอียด"><ArrowLeft aria-hidden="true" strokeWidth={1.8} /></Link>
            <h1>ยืนยันการอนุมัติ</h1>
          </div>
          <div className="ap-ctile first"><Tile kind="influencer" size={52} /><span style={{ minWidth: 0 }}><small>คัดเลือกอินฟลูเอนเซอร์ · {refLabel(r.refNo)}</small><b>{p.name}</b></span></div>
          {p.deliverables && <div className="ap-ctile"><span><PlatformIcon p={p.platform} /></span><span style={{ minWidth: 0 }}><small>ชิ้นงาน</small><b>{p.deliverables}</b></span></div>}
          {p.deliverBy && <div className="ap-ctile"><span><CalendarDays aria-hidden="true" /></span><span style={{ minWidth: 0 }}><small>วันส่ง</small><b>ภายใน {thaiShort(p.deliverBy, true)}</b></span></div>}
          <div className="ap-big">
            <small>ค่าจ้าง</small><b>{p.feeSatang !== null ? baht(p.feeSatang) : "ไม่ระบุ"}</b>
            <span>คนที่ {idx + 1} จาก {r.people.length} คนในคำขอนี้{left === 1 ? " · คนสุดท้ายที่รอ คำขอจะอนุมัติครบ" : ""}</span>
          </div>
          <Link href={back} className="ap-rowlink">ดูรายละเอียด{p.name}<ChevronRight aria-hidden="true" /></Link>
          <div className="ap-spacer" />
          <p className="ap-fine">เมื่อยืนยันแล้ว ระบบบันทึกชื่อผู้อนุมัติพร้อมเวลา<br />และแจ้งทีมที่ส่งคำขอทันที</p>
          <ConfirmApprove requestId={r.id} personId={p.id} />
          <Link href={back} className="ap-btn ghost block h48" style={{ marginTop: 6 }}>กลับไปดูรายละเอียด</Link>
        </div>
      </div>
    </div>
  );
}
