import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KolHead, Pill, Note } from "@/components/kol/ui";
import { CeoStrip, ceoHref } from "@/components/kol/ceo-ui";
import { DecideForm } from "@/components/kol/ceo-decide";
import { loadCeo, type CeoParams } from "../../load";

const KINDS = ["reject", "request", "approve"] as const;

/** Request More Info / Reject / Approve confirmation (Master RCM 12–14). A decided card goes straight to its result. */
export default async function CeoDecide(p: CeoParams & { params: Promise<{ id: string; kind: string }> }) {
  const { kind } = await p.params;
  if (!KINDS.includes(kind as (typeof KINDS)[number])) notFound();
  const k = kind as (typeof KINDS)[number];
  const { user, ctx, canDecide, pending } = await loadCeo(p, (id, tab) => ceoHref.decide(id, k, tab));
  const c = ctx.card, a = c.applicant, tab = ctx.tab;
  if (!pending) redirect(ceoHref.done(c.requestId, tab));
  return (
    <>
      <KolHead user={user} title="CEO Approval" sub="พิจารณา KOL ที่สมัครเข้าร่วมแคมเปญ" back={ceoHref.card(c.requestId, tab)}
        right={<Pill label={`รายการที่ ${ctx.index + 1} จาก ${ctx.total}`}><b>{ctx.index + 1}</b> / {ctx.total}</Pill>} />
      <div style={{ marginTop: 14 }}><CeoStrip name={a.creatorName} refNo={a.refNo} photoFileId={a.photoFileId} social={a.social} /></div>
      <div style={{ marginTop: 14 }}>
        {canDecide
          ? <DecideForm kind={k} requestId={c.requestId} name={a.creatorName} campaign={c.campaignName} backHref={ceoHref.card(c.requestId, tab)} doneHref={ceoHref.done(c.requestId, tab)} />
          : <div className="k-card"><Note tone="warn">ตัดสินใจได้เฉพาะ CEO — บัญชีนี้ดูการ์ดได้อย่างเดียว</Note><Link href={ceoHref.card(c.requestId, tab)} className="k-btn pinksoft" style={{ marginTop: 12 }}>กลับไปที่การ์ด</Link></div>}
      </div>
    </>
  );
}
