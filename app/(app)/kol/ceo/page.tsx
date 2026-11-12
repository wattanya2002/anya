import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { ceoCounts, ceoInbox, kolReady } from "@/lib/kol";
import { CEO_TABS, parseCeoTab } from "@/lib/kol-core";
import { Empty, KolHead } from "@/components/kol/ui";
import { CeoList } from "@/components/kol/ceo-card";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** CEO Inbox: one card per KOL proposed by Marketing (latest round). Decisions are made inside the card. */
export default async function CeoInbox({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  await kolReady(user);
  const sp = await searchParams;
  const tab = parseCeoTab(one(sp.tab));
  const cardId = /^[0-9a-f-]{36}$/i.test(one(sp.card)) ? one(sp.card) : null;
  const [counts, list] = await Promise.all([ceoCounts(user.orgId), ceoInbox(user.orgId, tab)]);
  let cards = list;
  if (cardId && !cards.some((c) => c.requestId === cardId)) cards = [...(await ceoInbox(user.orgId, "all", cardId)), ...cards];
  const canDecide = can(user, "kol.decide");
  return (
    <>
      <KolHead user={user} active="ceo" title="CEO Approval" sub={canDecide ? `รอพิจารณา ${counts.pending} รายการ · เรียงตามวันที่เสนอ` : "ดูสถานะการพิจารณา (ตัดสินใจได้เฉพาะ CEO)"} pending={counts.pending} />
      <nav className="k-chips" aria-label="กรองการ์ด" style={{ marginTop: 14 }}>
        {CEO_TABS.map((t) => (
          <Link key={t.key} href={t.key === "pending" ? "/kol/ceo" : `/kol/ceo?tab=${t.key}`} className="k-chip" aria-current={t.key === tab ? "true" : undefined}>
            {t.label}<span className="k-count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <div className="k-card" style={{ marginTop: 14 }}>
          <Empty icon={<ClipboardCheck aria-hidden="true" />} title={tab === "pending" ? "ไม่มีการ์ดรอพิจารณา" : "ยังไม่มีรายการในกลุ่มนี้"} body={tab === "pending" ? "เมื่อ Marketing เสนอ KOL การ์ดจะขึ้นที่นี่ทันที" : undefined} />
        </div>
      ) : (
        <CeoList cards={cards} canDecide={canDecide} openId={cardId} meId={user.id} />
      )}
    </>
  );
}
