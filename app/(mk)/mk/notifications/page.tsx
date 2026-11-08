import Link from "next/link";
import { Bell, Check, ChevronRight, Clock, MessageCircle, Megaphone, Sparkles, Tag, Users } from "lucide-react";
import { can } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { notificationCards, type NotifCard as Card, mkViewer } from "@/lib/mk";
import { acknowledge, acknowledgeAll } from "../actions";
import { baht, dueLabel, refLabel, relTime, thaiShort, thaiRange } from "@/lib/mk-core";
import { Avatar, Empty, Head, MkNav, Panel, Screen, StatusPill } from "@/components/mk/ui";
import { NotifCard } from "@/components/mk/notif-card";
import { CommentBox } from "@/components/mk/comment-box";

export const metadata = { title: "แจ้งเตือน · MK" };

const TYPE = {
  due: { label: "ใกล้ครบกำหนด", icon: <Clock aria-hidden="true" /> },
  comment: { label: "ทีมตอบคอมเมนต์", icon: <MessageCircle aria-hidden="true" /> },
  new: { label: "คำขอใหม่", icon: <Sparkles aria-hidden="true" /> },
} as const;
const FILTERS = [
  { k: "all", label: "ทั้งหมด" }, { k: "new", label: "คำขอใหม่" }, { k: "due", label: "ใกล้ครบกำหนด" }, { k: "comment", label: "ทีมตอบคอมเมนต์" },
] as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = FILTERS.some((x) => x.k === sp.f) ? (sp.f as (typeof FILTERS)[number]["k"]) : "all";
  const user = await mkViewer();
  const today = bangkokToday();
  const all = await notificationCards(user);
  const cards = f === "all" ? all : all.filter((c) => c.type === f);
  const unread = all.filter((c) => c.unread).length;
  const decide = can(user, "approvals.decide");
  const now = new Date();
  let opened = 0;

  const caps = (c: Card) => {
    const r = c.request;
    const due = dueLabel(r.decideBy, today);
    const first = r.kind === "promotion"
      ? { icon: <Tag aria-hidden="true" />, t: [r.discountText, r.startsOn ? thaiRange(r.startsOn, r.endsOn ?? r.startsOn) : null].filter(Boolean).join(" · ") || "โปรโมชัน" }
      : r.kind === "influencer"
        ? { icon: <Users aria-hidden="true" />, t: `${r.peopleCount} คน${r.amountSatang !== null ? ` · ค่าจ้างรวม ${baht(r.amountSatang)}` : ""}` }
        : { icon: <Megaphone aria-hidden="true" />, t: r.amountSatang !== null ? `งบ ${baht(r.amountSatang)}` : refLabel(r.refNo) };
    return (
      <>
        <span>{first.icon}{first.t}</span>
        <span className={r.status === "pending" && due.urgent ? "red" : undefined}><Clock aria-hidden="true" />
          {r.status === "pending" ? `ตัดสินใจ${due.text}` : `กำหนด ${thaiShort(r.decideBy)}`}</span>
      </>
    );
  };

  return (
    <Screen>
      <Head title="แจ้งเตือน"
        sub={<>{unread > 0 && <span className="ap-pill lg" data-s="pink">ยังไม่อ่าน {unread}</span>}<span>วันนี้ {thaiShort(today, true)}</span></>}
        right={unread > 0 ? (
          <form action={acknowledgeAll}>
            <input type="hidden" name="ids" value={all.filter((c) => c.unread).map((c) => c.request.id).join(",")} />
            <button type="submit" className="ap-btn white h44" style={{ flex: "0 0 auto", boxShadow: "none" }}>อ่านทั้งหมด</button>
          </form>
        ) : undefined} />
      <Panel soft>
        <nav className="ap-nfilter" aria-label="ประเภทการแจ้งเตือน">
          {FILTERS.map((x) => <Link key={x.k} href={x.k === "all" ? "/mk/notifications" : `/mk/notifications?f=${x.k}`} aria-current={f === x.k ? "page" : undefined}>{x.label}</Link>)}
        </nav>
        {cards.length > 0 && <p className="ap-note" style={{ margin: "10px 2px 0" }}>แตะที่การ์ดเพื่อเปิดหรือซ่อนรายละเอียด</p>}
        {cards.length === 0 && (
          <Empty icon={<Bell aria-hidden="true" />} title={f === "all" ? "ยังไม่มีการแจ้งเตือน" : "ไม่มีการแจ้งเตือนประเภทนี้"}>
            คำขอใหม่ คำขอใกล้ครบกำหนด และคอมเมนต์จากทีมจะแสดงที่นี่
          </Empty>
        )}
        {cards.map((c) => {
          const r = c.request;
          const open = c.unread && opened++ < 2;
          const approveHref = r.kind === "influencer" ? `/mk/requests/${r.id}#people` : `/mk/requests/${r.id}/confirm`;
          return (
            <NotifCard key={c.key} type={c.type} title={r.title} status={<StatusPill status={r.status} />} defaultOpen={open}
              head={
                <span className="ap-ncard-top">
                  <span className="ap-ncard-kind"><span>{TYPE[c.type].icon}</span>{c.type === "comment" && c.mine ? "คอมเมนต์ใหม่ในคำขอของคุณ" : TYPE[c.type].label}</span>
                  <span className="ap-ncard-when">{relTime(c.at, now)}{c.unread && <span className="ap-unread" role="img" aria-label="ยังไม่อ่าน" />}</span>
                </span>
              }
              caps={caps(c)}
              extra={c.lastComment ? (
                <div className="ap-nlast">
                  <div><Avatar name={c.lastComment.name} /><div style={{ minWidth: 0, overflowWrap: "anywhere" }}><b style={{ fontWeight: 600 }}>{c.lastComment.name}</b> <small>· {relTime(c.lastComment.at, now)}</small><br /><span style={{ whiteSpace: "pre-line" }}>{c.lastComment.body}</span></div></div>
                </div>
              ) : undefined}
              startWithComposer={c.type === "comment" && c.unread}
              composer={<CommentBox requestId={r.id} id={`n-${r.id}`} compact label={`ตอบในคำขอ ${refLabel(r.refNo)}`} placeholder="พิมพ์คอมเมนต์ถึงทีม" />}
              ack={c.acked
                  ? <button type="button" className="ap-btn h44 done" disabled><Check aria-hidden="true" />รับทราบแล้ว</button>
                  : <form action={acknowledge}><input type="hidden" name="request_id" value={r.id} /><button type="submit" className="ap-btn h44">รับทราบ</button></form>}
              approve={decide && r.status === "pending" ? (
                <Link href={approveHref} className="ap-btn h44 primary" style={{ padding: "0 10px 0 14px" }}>อนุมัติ<ChevronRight aria-hidden="true" style={{ width: 18, height: 18 }} /></Link>
              ) : undefined}
              footer={<Link href={`/mk/requests/${r.id}`} className="ap-link" style={{ minHeight: 40, marginTop: 4, fontSize: 14 }}>ดูรายละเอียดคำขอ<ChevronRight aria-hidden="true" style={{ width: 16, height: 16 }} /></Link>}
            />
          );
        })}
      </Panel>
      <MkNav active="notif" unread={unread} />
    </Screen>
  );
}
