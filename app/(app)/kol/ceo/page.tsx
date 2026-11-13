import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ClipboardCheck, Megaphone } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { ceoCounts, ceoInbox, kolReady } from "@/lib/kol";
import { CEO_TABS, DECISION_LABEL, applicantRef, parseCeoTab } from "@/lib/kol-core";
import { Empty, KolHead, KolPhoto, Pill, SocialPair } from "@/components/kol/ui";
import { ceoHref } from "@/components/kol/ceo-ui";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TONE: Record<string, string> = { pending: "amber", approved: "green", rejected: "red", info_requested: "purple" };

/** CEO Approval queue (Master RCM screen 04): one card per KOL proposed by Marketing (latest round); tap a card to open the master card. */
export default async function CeoQueue({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  await kolReady(user);
  const sp = await searchParams;
  const tab = parseCeoTab(one(sp.tab));
  const cardId = one(sp.card);
  if (/^[0-9a-f-]{36}$/i.test(cardId)) redirect(ceoHref.card(cardId.toLowerCase(), tab)); // links from before the redesign
  const [counts, cards] = await Promise.all([ceoCounts(user.orgId), ceoInbox(user.orgId, tab)]);
  const canDecide = can(user, "kol.decide");
  return (
    <>
      <KolHead user={user} active="ceo" title="CEO Approval" back="/kol" pending={counts.pending}
        sub={canDecide ? "พิจารณา KOL ที่สมัครเข้าร่วมแคมเปญ" : "ดูสถานะการพิจารณา (ตัดสินใจได้เฉพาะ CEO)"}
        right={<Pill>{counts[tab].toLocaleString("en-US")} รายการ</Pill>} />
      <nav className="k-chips" aria-label="กรองการ์ด" style={{ marginTop: 22, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
        {CEO_TABS.map((t) => (
          <Link key={t.key} href={ceoHref.queue(t.key)} className="k-chip" aria-current={t.key === tab ? "true" : undefined}>
            {t.label}<span className="k-count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <div className="k-card" style={{ marginTop: 22 }}>
          <Empty icon={<ClipboardCheck aria-hidden="true" />} title={tab === "pending" ? "ไม่มี KOL รอพิจารณา" : "ยังไม่มีรายการในกลุ่มนี้"}
            body={tab === "pending" ? "เมื่อ Marketing เสนอ KOL การ์ดจะขึ้นที่นี่ทันที" : undefined} />
          <div style={{ display: "flex", justifyContent: "center" }}><Link href="/kol" className="k-btn pinksoft">กลับหน้ารายการผู้สมัคร</Link></div>
        </div>
      ) : (
        <ul className="k-cards" style={{ marginTop: 22 }}>
          {cards.map((c) => {
            const a = c.applicant;
            return (
              <li key={c.requestId} className="k-ceo-row">
                <Link href={ceoHref.card(c.requestId, tab)} className="k-app" aria-label={`${a.creatorName} ${applicantRef(a.refNo)} — ${DECISION_LABEL[c.requestStatus]} — เปิดการ์ด`}>
                  <KolPhoto name={a.creatorName} fileId={a.photoFileId} large />
                  <div style={{ minWidth: 0 }}>
                    <div className="k-app-top">
                      <h2 className="k-app-name"><b>{a.creatorName}</b><span className="k-code">{applicantRef(a.refNo)}</span></h2>
                      {tab !== "pending" && <span className="k-badge" data-tone={TONE[c.requestStatus] ?? "navy"}>{DECISION_LABEL[c.requestStatus]}</span>}
                    </div>
                    <div className="k-row nowrap" style={{ gap: 6, alignItems: "center" }}>
                      <div className="k-grow"><SocialPair social={a.social} handle={false} /></div>
                      <ChevronRight className="k-chev" aria-hidden="true" style={{ marginTop: 10 }} />
                    </div>
                    <div className="k-camp"><Megaphone aria-hidden="true" /><span>{c.campaignName}</span></div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
