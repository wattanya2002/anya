import "server-only";
import { db } from "./db";
import { windows, bangkokToday } from "./dates";
import { growthPct, ratePct, pointDelta } from "./calc/kpi";
import type { CurrentUser } from "./auth";
import { can } from "./auth";

export type Kpi = { value: number | null; delta: number | null; deltaUnit: "pct" | "pt" };

export type DashboardData = {
  rangeDays: number;
  hasBookingData: boolean;
  bookings: Kpi;
  revenueSatang: Kpi | "forbidden";
  newCustomers: Kpi;
  returnRate: Kpi;
  marketing: {
    hasData: boolean;
    reachPlatform: string | null;
    reach: Kpi;
    clicks: Kpi;
    conversion: Kpi;
    series: number[];
  } | "forbidden";
  courts: { total: number; slices: { name: string; color: string; count: number; pct: number }[]; configured: boolean };
  promotion: {
    name: string; code: string | null; status: string; coverImagePath: string | null;
    uses: number; revenueSatang: number | null; rating: number | null; ratingCount: number;
  } | null | "forbidden";
  tasks: { id: string; title: string; dueTime: string | null; done: boolean }[];
  unreadNotifications: number;
  sources: { label: string; source: string | null; at: Date | null }[];
};

const PLATFORM_TH: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", line: "LINE OA" };

export async function loadDashboard(user: CurrentUser, rangeDays: number): Promise<DashboardData> {
  const q = db();
  const org = user.orgId;
  const w = windows(rangeDays);
  const today = bangkokToday();

  // ------------------------------------------------ booking KPIs (imported bookings, status = paid)
  const bookingAgg = await q.query(
    `with paid as (
       select play_date, amount_satang, customer_ref from bookings_imported
        where org_id = $1 and status = 'paid'),
     firsts as (select customer_ref, min(play_date) as first_date from paid where customer_ref is not null group by customer_ref)
     select
       (select count(*) from bookings_imported where org_id = $1)::int as any_rows,
       count(*) filter (where play_date between $2 and $3)::int as cur_count,
       count(*) filter (where play_date between $4 and $5)::int as prev_count,
       coalesce(sum(amount_satang) filter (where play_date between $2 and $3), 0)::bigint as cur_rev,
       coalesce(sum(amount_satang) filter (where play_date between $4 and $5), 0)::bigint as prev_rev,
       (select count(*) from firsts where first_date between $2 and $3)::int as cur_new,
       (select count(*) from firsts where first_date between $4 and $5)::int as prev_new,
       (select count(distinct p.customer_ref) from paid p where p.customer_ref is not null and p.play_date between $2 and $3)::int as cur_active,
       (select count(distinct p.customer_ref) from paid p join firsts f using (customer_ref)
          where p.play_date between $2 and $3 and f.first_date < $2)::int as cur_returning,
       (select count(distinct p.customer_ref) from paid p where p.customer_ref is not null and p.play_date between $4 and $5)::int as prev_active,
       (select count(distinct p.customer_ref) from paid p join firsts f using (customer_ref)
          where p.play_date between $4 and $5 and f.first_date < $4)::int as prev_returning
     from paid`,
    [org, w.curStart, w.curEnd, w.prevStart, w.prevEnd],
  );
  const b = bookingAgg.rows[0];
  const hasBookingData = b.any_rows > 0;
  const curReturn = ratePct(b.cur_returning, b.cur_active);
  const prevReturn = ratePct(b.prev_returning, b.prev_active);
  const kpi = (cur: number, prev: number): Kpi =>
    hasBookingData ? { value: cur, delta: growthPct(cur, prev), deltaUnit: "pct" } : { value: null, delta: null, deltaUnit: "pct" };

  // ------------------------------------------------ marketing (social snapshots + attributed bookings)
  let marketing: DashboardData["marketing"] = "forbidden";
  if (can(user, "marketing.view")) {
    const reachRows = await q.query(
      `select platform,
              coalesce(sum(value) filter (where snapshot_date between $2 and $3), 0)::float8 as cur,
              coalesce(sum(value) filter (where snapshot_date between $4 and $5), 0)::float8 as prev
         from social_metric_snapshots where org_id = $1 and metric = 'reach'
        group by platform order by cur desc limit 1`,
      [org, w.curStart, w.curEnd, w.prevStart, w.prevEnd],
    );
    const clickAgg = await q.query(
      `select coalesce(sum(value) filter (where snapshot_date between $2 and $3), 0)::float8 as cur,
              coalesce(sum(value) filter (where snapshot_date between $4 and $5), 0)::float8 as prev,
              count(*)::int as n
         from social_metric_snapshots where org_id = $1 and metric = 'link_clicks'`,
      [org, w.curStart, w.curEnd, w.prevStart, w.prevEnd],
    );
    const attributed = await q.query(
      `select count(*) filter (where play_date between $2 and $3)::int as cur,
              count(*) filter (where play_date between $4 and $5)::int as prev
         from bookings_imported
        where org_id = $1 and status = 'paid' and source_channel in ('facebook','instagram','tiktok','line')`,
      [org, w.curStart, w.curEnd, w.prevStart, w.prevEnd],
    );
    const series = await q.query(
      `select d::date as day, coalesce(sum(s.value), 0)::float8 as v
         from generate_series($2::date, $3::date, interval '1 day') d
         left join social_metric_snapshots s
           on s.org_id = $1 and s.metric = 'link_clicks' and s.snapshot_date = d::date
        group by d order by d`,
      [org, w.curStart, w.curEnd],
    );
    const r = reachRows.rows[0];
    const c = clickAgg.rows[0];
    const a = attributed.rows[0];
    const hasData = Boolean(r) || c.n > 0;
    const curConv = ratePct(a.cur, c.cur);
    const prevConv = ratePct(a.prev, c.prev);
    marketing = {
      hasData,
      reachPlatform: r ? PLATFORM_TH[r.platform] ?? r.platform : null,
      reach: r ? { value: r.cur, delta: growthPct(r.cur, r.prev), deltaUnit: "pct" } : { value: null, delta: null, deltaUnit: "pct" },
      clicks: c.n > 0 ? { value: c.cur, delta: growthPct(c.cur, c.prev), deltaUnit: "pct" } : { value: null, delta: null, deltaUnit: "pct" },
      conversion: { value: c.n > 0 ? curConv : null, delta: pointDelta(curConv, prevConv), deltaUnit: "pt" },
      series: series.rows.map((row) => Number(row.v)),
    };
  }

  // ------------------------------------------------ court type split
  const courtRows = await q.query(
    `select ct.name_th, ct.color, ct.sort_order,
            count(bi.id) filter (where bi.status = 'paid' and bi.play_date between $2 and $3)::int as n
       from court_types ct
       left join bookings_imported bi on bi.court_type_id = ct.id
      where ct.org_id = $1
      group by ct.id order by ct.sort_order, ct.name_th`,
    [org, w.curStart, w.curEnd],
  );
  const courtTotal = courtRows.rows.reduce((s, r) => s + r.n, 0);
  const courts = {
    configured: courtRows.rows.length > 0,
    total: courtTotal,
    slices: courtRows.rows.map((r) => ({
      name: r.name_th, color: r.color, count: r.n, pct: courtTotal > 0 ? (r.n / courtTotal) * 100 : 0,
    })),
  };

  // ------------------------------------------------ promotion in use
  let promotion: DashboardData["promotion"] = "forbidden";
  if (can(user, "promotions.view")) {
    const pr = await q.query(
      `select p.id, p.name, p.code, p.status, p.cover_image_path,
              count(bi.id) filter (where bi.status = 'paid' and bi.play_date between $2 and $3)::int as uses,
              coalesce(sum(bi.amount_satang) filter (where bi.status = 'paid' and bi.play_date between $2 and $3), 0)::bigint as rev,
              (select avg(rating)::float8 from promotion_feedback f where f.promotion_id = p.id and f.received_on between $2 and $3) as rating,
              (select count(*)::int from promotion_feedback f where f.promotion_id = p.id and f.received_on between $2 and $3) as rating_n
         from promotions p
         left join bookings_imported bi on bi.promotion_id = p.id
        where p.org_id = $1 and p.status = 'live'
          and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())
        group by p.id order by uses desc, p.created_at desc limit 1`,
      [org, w.curStart, w.curEnd],
    );
    const p = pr.rows[0];
    promotion = p
      ? {
          name: p.name, code: p.code, status: p.status, coverImagePath: p.cover_image_path, uses: p.uses,
          revenueSatang: can(user, "dashboard.view_financial") ? Number(p.rev) : null,
          rating: p.rating === null ? null : Number(p.rating), ratingCount: p.rating_n,
        }
      : null;
  }

  // ------------------------------------------------ today tasks, notifications, freshness
  const tasks = await q.query(
    `select id, title, to_char(due_time, 'HH24:MI') as due_time, status
       from tasks where org_id = $1 and due_date = $2 and status <> 'cancelled'
      order by due_time nulls last, created_at`,
    [org, today],
  );
  const unread = await q.query(
    `select count(*)::int as n from notifications where user_id = $1 and org_id = $2 and read_at is null`,
    [user.id, org],
  );
  const fresh = await q.query(
    `select 'bookings' as kind, (select source from import_jobs where org_id = $1 and kind = 'bookings' and status = 'completed' order by finished_at desc limit 1) as source,
            (select max(finished_at) from import_jobs where org_id = $1 and kind = 'bookings' and status = 'completed') as at
     union all
     select 'social', (select source from social_metric_snapshots where org_id = $1 order by updated_at desc limit 1),
            (select max(updated_at) from social_metric_snapshots where org_id = $1)`,
    [org],
  );

  const revenue: Kpi | "forbidden" = can(user, "dashboard.view_financial") ? kpi(Number(b.cur_rev), Number(b.prev_rev)) : "forbidden";

  return {
    rangeDays,
    hasBookingData,
    bookings: kpi(b.cur_count, b.prev_count),
    revenueSatang: revenue,
    newCustomers: kpi(b.cur_new, b.prev_new),
    returnRate: hasBookingData ? { value: curReturn, delta: pointDelta(curReturn, prevReturn), deltaUnit: "pt" } : { value: null, delta: null, deltaUnit: "pt" },
    marketing,
    courts,
    promotion,
    tasks: tasks.rows.map((t) => ({ id: t.id, title: t.title, dueTime: t.due_time, done: t.status === "done" })),
    unreadNotifications: unread.rows[0].n,
    sources: fresh.rows.map((r) => ({
      label: r.kind === "bookings" ? "การจอง" : "โซเชียล",
      source: r.source,
      at: r.at ? new Date(r.at) : null,
    })),
  };
}
