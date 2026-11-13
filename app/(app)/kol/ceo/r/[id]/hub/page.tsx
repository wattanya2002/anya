import Link from "next/link";
import { ChevronRight, ClipboardList, ExternalLink, History, Images, Megaphone, MessagesSquare, UserRound } from "lucide-react";
import { KolHead, Pill } from "@/components/kol/ui";
import { CeoStrip, DecisionArea, ceoHref } from "@/components/kol/ceo-ui";
import { loadCeo, decidedOf, type CeoParams } from "../load";

/** KOL Detail Hub (Master RCM screen 06): short profile and the information groups to open. */
export default async function CeoHub(p: CeoParams) {
  const { user, ctx, canDecide, pending } = await loadCeo(p, ceoHref.hub);
  const c = ctx.card, a = c.applicant, tab = ctx.tab;
  const last = c.comments.at(-1);
  const items = [
    { key: "info", icon: <UserRound />, title: "ข้อมูลส่วนตัว", sub: [a.fullName, a.categories.join(" · ")].filter(Boolean).join(" · ") },
    { key: "social", icon: <Images />, title: "Social & ผลงาน", sub: `${a.social.length} ช่องทาง · ผลงาน ${a.sampleFiles.length + a.sampleLinks.length} รายการ` },
    { key: "proposal", icon: <ClipboardList />, title: "ข้อเสนอ Marketing", sub: c.shortPitch },
    { key: "campaign", icon: <Megaphone />, title: "แคมเปญ", sub: c.campaignName },
    { key: "comments", icon: <MessagesSquare />, title: `ความคิดเห็น${c.comments.length ? ` (${c.comments.length})` : ""}`, sub: last ? `${last.authorName}: ${last.body}` : "ยังไม่มีความคิดเห็น" },
    { key: "history", icon: <History />, title: "ประวัติ", sub: `รอบที่ ${c.roundNo} · สถานะและผลการพิจารณา` },
  ];
  return (
    <>
      <KolHead user={user} title="รายละเอียด KOL" sub="ข้อมูลประกอบการพิจารณา" back={ceoHref.card(c.requestId, tab)}
        right={<Pill label={`รายการที่ ${ctx.index + 1} จาก ${ctx.total}`}><b>{ctx.index + 1}</b> / {ctx.total}</Pill>} />
      <div style={{ marginTop: 22 }}><CeoStrip name={a.creatorName} refNo={a.refNo} photoFileId={a.photoFileId} social={a.social} pink /></div>
      <ul className="k-hub-menu" style={{ marginTop: 22 }}>
        {items.map((it) => (
          <li key={it.key}>
            <Link href={ceoHref.section(c.requestId, it.key, tab)}>
              <i aria-hidden="true">{it.icon}</i><span style={{ minWidth: 0 }}><b>{it.title}</b><small>{it.sub || "–"}</small></span><ChevronRight className="k-chev" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
        <Link href={`/kol/applicants/${a.id}`} className="k-btn sm ghost"><ExternalLink aria-hidden="true" />เปิดใบสมัครเต็ม</Link>
      </div>
      <div style={{ marginTop: 22 }}><DecisionArea id={c.requestId} tab={tab} name={a.creatorName} pending={pending} canDecide={canDecide} decided={decidedOf(c)} /></div>
    </>
  );
}
