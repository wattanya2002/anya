import Link from "next/link";
import { CalendarDays, Clock, Filter, Inbox, Plus, X } from "lucide-react";
import { can } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { listRequests, statusCounts, unreadCount, mkViewer } from "@/lib/mk";
import { KIND_LABEL, MK_KINDS, parseKind, parseRange, parseTab, thaiRange, weekEndSunFirst, type MkKind, type MkTab } from "@/lib/mk-core";
import { TypeMenu } from "@/components/mk/type-menu";
import { BellLink, Empty, Head, MkNav, Panel, ReqRow, Screen, Tile, Toast } from "@/components/mk/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(base: { tab: MkTab; kind: MkKind | null; range: { from: string; to: string } | null }, patch: Partial<{ tab: MkTab; kind: MkKind | null; range: { from: string; to: string } | null }>) {
  const s = { ...base, ...patch };
  const q = new URLSearchParams();
  if (s.tab !== "pending") q.set("tab", s.tab);
  if (s.kind) q.set("type", s.kind);
  if (s.range) { q.set("from", s.range.from); q.set("to", s.range.to); }
  const qs = q.toString();
  return qs ? `/mk?${qs}` : "/mk";
}

export default async function MkOverview({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await mkViewer();
  const today = bangkokToday();
  const tab = parseTab(one(sp.tab));
  const kind = parseKind(one(sp.type));
  const range = parseRange(one(sp.from), one(sp.to));
  const done = one(sp.done);
  const base = { tab, kind, range };
  const [counts, rows, unread] = await Promise.all([
    statusCounts(user),
    listRequests(user, { tab, kind, from: range?.from ?? null, to: range?.to ?? null }),
    unreadCount(user),
  ]);
  const filtered = !!(kind || range);
  const weekEnd = weekEndSunFirst(today);
  const thisWeek = rows.filter((r) => r.decideBy <= weekEnd);
  const later = rows.filter((r) => r.decideBy > weekEnd);
  const rangeHref = `/mk/range?${new URLSearchParams({ ...(range ?? {}), ...(tab !== "pending" ? { tab } : {}), ...(kind ? { type: kind } : {}) })}`;

  const right = (
    <>
      {can(user, "approvals.submit") && (
        <Link href="/mk/new" className="ap-ibtn" aria-label="ส่งคำขอใหม่"><Plus aria-hidden="true" strokeWidth={2} /></Link>
      )}
      <BellLink unread={unread} />
    </>
  );
  const sub = (
    <>
      <span className="ap-pill lg white">รออนุมัติ {counts.pending} รายการ</span>
      {counts.dueTomorrow > 0 && <span className="ap-due"><Clock aria-hidden="true" strokeWidth={2} />ครบกำหนดภายในพรุ่งนี้ {counts.dueTomorrow}</span>}
    </>
  );
  const tabs: { k: MkTab; label: string; n: number | null }[] = [
    { k: "pending", label: "รออนุมัติ", n: counts.pending },
    { k: "approved", label: "อนุมัติแล้ว", n: null },
    { k: "returned", label: "ส่งกลับแก้ไข", n: counts.returned || null },
  ];

  return (
    <Screen>
      {done === "returned" && <Toast tone="amber" title="ส่งกลับแก้ไขแล้ว" sub="เหตุผลอยู่ในประวัติคำขอ และแจ้งทีมแล้ว" />}
      <Head title="MK" sub={sub} right={right} />
      <Panel>
        <nav className="ap-seg" aria-label="สถานะคำขอ">
          {tabs.map((t) => (
            <Link key={t.k} href={href(base, { tab: t.k })} aria-current={t.k === tab ? "page" : undefined}>
              <span>{t.label}</span>{t.n !== null && <b>{t.n}</b>}
            </Link>
          ))}
        </nav>

        <div className="ap-filters">
          <TypeMenu active={!!kind} activeLabel={kind ? KIND_LABEL[kind] : null} options={[
            { key: "all", label: "ทั้งหมด", href: href(base, { kind: null }), current: !kind, tile: <Tile kind="all" size={36} /> },
            ...MK_KINDS.map((k) => ({ key: k, label: KIND_LABEL[k], href: href(base, { kind: k }), current: kind === k, tile: <Tile kind={k} size={36} /> })),
          ]} />
          <Link href={rangeHref} className={`ap-ficon${range ? " on" : ""}`} aria-label={range ? `กรองตามช่วงวันที่ ${thaiRange(range.from, range.to)}` : "กรองตามช่วงวันที่"} title="ช่วงวันที่">
            <CalendarDays aria-hidden="true" strokeWidth={1.8} />
          </Link>
          {kind && (
            <span className="ap-chip">{KIND_LABEL[kind]}
              <Link href={href(base, { kind: null })} aria-label={`ลบตัวกรองประเภท ${KIND_LABEL[kind]}`}><X aria-hidden="true" strokeWidth={2.2} /></Link>
            </span>
          )}
          {range && (
            <span className="ap-chip">{thaiRange(range.from, range.to)}
              <Link href={href(base, { range: null })} aria-label="ลบตัวกรองช่วงวันที่"><X aria-hidden="true" strokeWidth={2.2} /></Link>
            </span>
          )}
          {kind && range && <Link className="ap-clear" href={href(base, { kind: null, range: null })}>ล้างทั้งหมด</Link>}
        </div>

        {rows.length === 0 ? (
          filtered ? (
            <Empty icon={<Filter aria-hidden="true" />} tone="blue" title="ไม่พบคำขอในตัวกรองนี้"
              action={<Link className="ap-btn pinksoft" href={href(base, { kind: null, range: null })}>ล้างตัวกรอง</Link>}>
              ลองเปลี่ยนประเภทหรือช่วงวันที่
            </Empty>
          ) : tab === "pending" ? (
            <Empty icon={<Inbox aria-hidden="true" />} title="ไม่มีคำขอรออนุมัติ"
              action={<Link className="ap-btn" href={href(base, { tab: "approved" })}>ดูที่อนุมัติแล้ว</Link>}>
              คำขอใหม่จากทีมจะแสดงที่นี่ และแจ้งเตือนทันที
            </Empty>
          ) : (
            <Empty icon={<Inbox aria-hidden="true" />} title={tab === "approved" ? "ยังไม่มีคำขอที่อนุมัติ" : "ไม่มีคำขอที่ส่งกลับแก้ไข"} />
          )
        ) : filtered || tab !== "pending" ? (
          <>
            <div className="ap-label">{filtered ? `ผลกรอง ${rows.length} รายการ · เรียงตาม${tab === "pending" ? "กำหนดตัดสินใจ" : "เวลาล่าสุด"}` : `${rows.length} รายการล่าสุด`}</div>
            <ul className="ap-rows">{rows.map((r) => <ReqRow key={r.id} r={r} today={today} showStatus={tab !== "pending" || filtered} />)}</ul>
          </>
        ) : (
          <>
            {thisWeek.length > 0 && <>
              <div className="ap-label">ครบกำหนดสัปดาห์นี้</div>
              <ul className="ap-rows">{thisWeek.map((r) => <ReqRow key={r.id} r={r} today={today} />)}</ul>
            </>}
            {later.length > 0 && <>
              <div className="ap-label" style={{ marginTop: 14 }}>ถัดไป</div>
              <ul className="ap-rows">{later.map((r) => <ReqRow key={r.id} r={r} today={today} />)}</ul>
            </>}
          </>
        )}
      </Panel>
      <MkNav active="req" unread={unread} />
    </Screen>
  );
}
