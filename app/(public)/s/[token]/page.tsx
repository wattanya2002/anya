import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { db } from "@/lib/db";
import { resolveToken } from "@/lib/kol-intake";
import { applicantRef, PUBLIC_STATUS, type ApplicantStatus } from "@/lib/kol-core";

export const metadata: Metadata = { title: "สถานะใบสมัคร KOL · Wonder Courts", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STEPS: { key: string; label: string; done: ApplicantStatus[] }[] = [
  { key: "sent", label: "ส่งใบสมัคร", done: ["submitted", "shortlisted", "info_requested", "pending_ceo", "ceo_info_requested", "approved", "rejected", "registered"] },
  { key: "review", label: "พิจารณาใบสมัคร", done: ["approved", "rejected", "registered"] },
  { key: "result", label: "ผลการคัดเลือก", done: ["approved", "rejected", "registered"] },
  { key: "register", label: "ลงทะเบียนและนัดวันเข้าใช้บริการ", done: ["registered"] },
];

/** Applicant's own status: private link only, no internal notes or comments, never other applicants. */
export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const who = await resolveToken(token, "status");
  if (!who) {
    return (
      <div className="pf-root"><div className="pf-wrap">
        <span className="pf-brand"><span className="pf-ball" aria-hidden="true" />Wonder Courts</span>
        <div className="pf-closed"><LinkIcon aria-hidden="true" /><h1>ลิงก์นี้ใช้ไม่ได้</h1><p>ลิงก์หมดอายุหรือไม่ถูกต้อง สอบถามสถานะได้ที่ LINE @wondercourts</p></div>
      </div></div>
    );
  }
  await db().query(`update kol_access_tokens set last_used_at = now() where id = $1`, [who.tokenId]);
  const s = who.status as ApplicantStatus;
  const pub = PUBLIC_STATUS[s];
  const nowIdx = STEPS.findIndex((x) => !x.done.includes(s));
  return (
    <div className="pf-root"><div className="pf-wrap">
      <span className="pf-brand"><span className="pf-ball" aria-hidden="true" />Wonder Courts</span>
      <div className="pf-status-card" role="status">
        <span className="pf-fact" style={{ boxShadow: "none", background: "#f5f8fb" }}>{applicantRef(who.refNo)} · {who.creatorName}</span>
        <h1>{pub.title}</h1>
        <p>{pub.body}</p>
        <ol className="pf-steps" aria-label="ขั้นตอน">
          {STEPS.filter((x) => s !== "rejected" || x.key !== "register").map((x, i) => (
            <li key={x.key} data-s={x.done.includes(s) ? "done" : i === nowIdx ? "now" : "todo"}><i>{i + 1}</i><span>{x.label}</span></li>
          ))}
        </ol>
      </div>
      <p className="pf-note">หน้านี้แสดงเฉพาะสถานะใบสมัครของคุณ ติดต่อทีมงานได้ที่ LINE @wondercourts</p>
    </div></div>
  );
}
