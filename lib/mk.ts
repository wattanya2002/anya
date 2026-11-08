import "server-only";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser, can, type CurrentUser } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { addDays } from "@/lib/calendar-core";
import { PROMO_COLORS, type MkKind, type MkPlatform, type MkStatus, type MkTab, type PromoSpan } from "@/lib/mk-core";

/** Every MK page starts here: signed in and allowed to see approvals (the layout also shows a no-access screen). */
export async function mkViewer(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!can(u, "approvals.view")) notFound();
  return u;
}

export type RequestRow = {
  id: string; refNo: number; kind: MkKind; title: string; status: MkStatus; amountSatang: number | null;
  decideBy: string; urgent: boolean; discountText: string | null; startsOn: string | null; endsOn: string | null;
  peopleCount: number; commentCount: number;
};

const ROW_SQL = `
  select r.id, r.ref_no, r.kind, r.title, r.status, r.amount_satang, to_char(r.decide_by, 'YYYY-MM-DD') as decide_by, r.urgent,
         r.discount_text, to_char(r.starts_on, 'YYYY-MM-DD') as starts_on, to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
         (select count(*)::int from approval_people p where p.request_id = r.id) as people_count,
         (select count(*)::int from approval_events e where e.request_id = r.id and e.kind = 'comment') as comment_count
    from approval_requests r`;

function toRow(r: Record<string, unknown>): RequestRow {
  return {
    id: r.id as string, refNo: r.ref_no as number, kind: r.kind as MkKind, title: r.title as string, status: r.status as MkStatus,
    amountSatang: r.amount_satang === null ? null : Number(r.amount_satang), decideBy: r.decide_by as string, urgent: r.urgent as boolean,
    discountText: r.discount_text as string | null, startsOn: r.starts_on as string | null, endsOn: r.ends_on as string | null,
    peopleCount: r.people_count as number, commentCount: r.comment_count as number,
  };
}

export async function statusCounts(user: CurrentUser): Promise<Record<MkTab, number> & { dueTomorrow: number }> {
  const today = bangkokToday();
  const { rows } = await db().query(
    `select count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'approved')::int as approved,
            count(*) filter (where status = 'returned')::int as returned,
            count(*) filter (where status = 'pending' and decide_by <= $2::date + 1)::int as due
       from approval_requests where org_id = $1`, [user.orgId, today]);
  const r = rows[0];
  return { pending: r.pending, approved: r.approved, returned: r.returned, dueTomorrow: r.due };
}

export async function listRequests(user: CurrentUser, o: { tab: MkTab; kind: MkKind | null; from: string | null; to: string | null }): Promise<RequestRow[]> {
  const args: unknown[] = [user.orgId, o.tab];
  let where = `where r.org_id = $1 and r.status = $2`;
  if (o.kind) { args.push(o.kind); where += ` and r.kind = $${args.length}`; }
  if (o.from && o.to) { args.push(o.from, o.to); where += ` and r.decide_by between $${args.length - 1} and $${args.length}`; }
  const order = o.tab === "pending" ? `order by r.urgent desc, r.decide_by, r.created_at` : `order by coalesce(r.decided_at, r.updated_at) desc`;
  const { rows } = await db().query(`${ROW_SQL} ${where} ${order} limit 200`, args);
  return rows.map(toRow);
}

export type Attachment = { id: string; kind: "image" | "file" | "link"; label: string; url: string };
export type Person = {
  id: string; name: string; platform: MkPlatform; handle: string | null; followers: number | null; feeSatang: number | null;
  avgViews: number | null; engagementBps: number | null; audience: string | null; deliverables: string | null; deliverBy: string | null;
  conditions: string | null; fitNote: string | null; photoUrl: string | null; profileUrl: string | null; status: "pending" | "approved";
  decidedByName: string | null; decidedAt: Date | null;
};
export type MkEvent = { id: string; kind: string; body: string | null; actorId: string; actorName: string; personId: string | null; createdAt: Date };
export type RequestDetail = RequestRow & {
  summary: string; channel: string | null; goal: string | null; adCopy: string | null; plan: string | null; conditions: string | null;
  allDay: boolean; startTime: string | null; endTime: string | null; repeat: string; remindOn: string | null; remindTime: string | null;
  remindBefore: string; remindLocation: boolean; remindMessaging: boolean; travelMinutes: number; calendarList: string; invitees: string | null;
  tags: string[]; flagged: boolean; priority: string; note: string | null; linkUrl: string | null;
  submittedBy: string; submitterName: string; createdAt: Date; decidedByName: string | null; decidedAt: Date | null; decisionNote: string | null;
  attachments: Attachment[]; people: Person[]; events: MkEvent[];
};

export async function getRequest(user: CurrentUser, id: string): Promise<RequestDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await db().query(
    `${ROW_SQL.replace("select r.id,", `select r.summary, r.channel, r.goal, r.ad_copy, r.plan, r.conditions, r.all_day,
            to_char(r.start_time, 'HH24:MI') as start_time, to_char(r.end_time, 'HH24:MI') as end_time, r.repeat,
            to_char(r.remind_on, 'YYYY-MM-DD') as remind_on, to_char(r.remind_time, 'HH24:MI') as remind_time, r.remind_before,
            r.remind_location, r.remind_messaging, r.travel_minutes, r.calendar_list, r.invitees, r.tags, r.flagged, r.priority, r.note,
            r.link_url, r.submitted_by, su.display_name as submitter_name, r.created_at, du.display_name as decider_name, r.decided_at,
            r.decision_note, r.id,`)}
       join users su on su.id = r.submitted_by
       left join users du on du.id = r.decided_by
      where r.id = $1 and r.org_id = $2`, [id, user.orgId]);
  const r = rows[0];
  if (!r) return null;
  const [att, ppl, ev] = await Promise.all([
    db().query(`select id, kind, label, url from approval_attachments where request_id = $1 and org_id = $2 order by sort_order, created_at`, [id, user.orgId]),
    db().query(
      `select p.*, to_char(p.deliver_by, 'YYYY-MM-DD') as deliver_by_s, u.display_name as decider_name
         from approval_people p left join users u on u.id = p.decided_by
        where p.request_id = $1 and p.org_id = $2 order by p.sort_order, p.created_at`, [id, user.orgId]),
    db().query(
      `select e.id::text as id, e.kind, e.body, e.actor_user_id, u.display_name as actor_name, e.person_id, e.created_at
         from approval_events e join users u on u.id = e.actor_user_id
        where e.request_id = $1 and e.org_id = $2 order by e.created_at, e.id`, [id, user.orgId]),
  ]);
  return {
    ...toRow(r),
    summary: r.summary, channel: r.channel, goal: r.goal, adCopy: r.ad_copy, plan: r.plan, conditions: r.conditions, allDay: r.all_day,
    startTime: r.start_time, endTime: r.end_time, repeat: r.repeat, remindOn: r.remind_on, remindTime: r.remind_time, remindBefore: r.remind_before,
    remindLocation: r.remind_location, remindMessaging: r.remind_messaging, travelMinutes: r.travel_minutes, calendarList: r.calendar_list,
    invitees: r.invitees, tags: r.tags ?? [], flagged: r.flagged, priority: r.priority, note: r.note, linkUrl: r.link_url,
    submittedBy: r.submitted_by, submitterName: r.submitter_name, createdAt: r.created_at, decidedByName: r.decider_name,
    decidedAt: r.decided_at, decisionNote: r.decision_note,
    attachments: att.rows.map((a) => ({ id: a.id, kind: a.kind, label: a.label, url: a.url })),
    people: ppl.rows.map((p) => ({
      id: p.id, name: p.name, platform: p.platform, handle: p.handle, followers: p.followers, feeSatang: p.fee_satang === null ? null : Number(p.fee_satang),
      avgViews: p.avg_views, engagementBps: p.engagement_bps, audience: p.audience, deliverables: p.deliverables, deliverBy: p.deliver_by_s,
      conditions: p.conditions, fitNote: p.fit_note, photoUrl: p.photo_url, profileUrl: p.profile_url, status: p.status,
      decidedByName: p.decider_name, decidedAt: p.decided_at,
    })),
    events: ev.rows.map((e) => ({ id: e.id, kind: e.kind, body: e.body, actorId: e.actor_user_id, actorName: e.actor_name, personId: e.person_id, createdAt: e.created_at })),
  };
}

// ---------------------------------------------------------------- calendar
export type DayItem = RequestRow;
export async function calendarMonth(user: CurrentUser, monthStart: string): Promise<{ dots: Record<string, number>; promos: PromoSpan[] }> {
  const from = monthStart;
  const next = new Date(`${monthStart}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  const to = addDays(next.toISOString().slice(0, 10), -1);
  const [due, promoReq, promoTbl] = await Promise.all([
    db().query(
      `select to_char(decide_by, 'YYYY-MM-DD') as d, count(*)::int as n from approval_requests
        where org_id = $1 and status = 'pending' and decide_by between $2 and $3 group by decide_by`, [user.orgId, from, to]),
    db().query(
      `select id, title, to_char(starts_on, 'YYYY-MM-DD') as s, to_char(coalesce(ends_on, starts_on), 'YYYY-MM-DD') as e
         from approval_requests
        where org_id = $1 and kind = 'promotion' and status in ('pending','approved') and starts_on is not null
          and starts_on <= $3 and coalesce(ends_on, starts_on) >= $2
        order by starts_on, title`, [user.orgId, from, to]),
    db().query(
      `select id, name, to_char(starts_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as s,
              to_char(coalesce(ends_at, starts_at) at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as e
         from promotions
        where org_id = $1 and status in ('approved','live') and starts_at is not null
          and (starts_at at time zone 'Asia/Bangkok')::date <= $3 and (coalesce(ends_at, starts_at) at time zone 'Asia/Bangkok')::date >= $2
        order by starts_at, name`, [user.orgId, from, to]),
  ]);
  const dots: Record<string, number> = {};
  for (const r of due.rows) dots[r.d] = r.n;
  const spans = [
    ...promoReq.rows.map((r) => ({ key: `req:${r.id}`, name: r.title as string, start: r.s as string, end: r.e as string })),
    ...promoTbl.rows.map((r) => ({ key: `promo:${r.id}`, name: r.name as string, start: r.s as string, end: r.e as string })),
  ].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  return { dots, promos: spans.map((p, i) => ({ ...p, color: PROMO_COLORS[i % PROMO_COLORS.length] })) };
}

export async function requestsDueOn(user: CurrentUser, day: string): Promise<RequestRow[]> {
  const { rows } = await db().query(`${ROW_SQL} where r.org_id = $1 and r.decide_by = $2 order by r.status, r.urgent desc, r.created_at`, [user.orgId, day]);
  return rows.map(toRow);
}

// ---------------------------------------------------------------- notification cards
export type NotifCard = {
  key: string; type: "due" | "comment" | "new"; request: RequestRow; at: Date; unread: boolean;
  lastComment: { name: string; body: string; at: Date } | null; acked: boolean; mine: boolean;
};

export async function notificationCards(user: CurrentUser): Promise<NotifCard[]> {
  const today = bangkokToday();
  const { rows } = await db().query(
    `with lastc as (
       select distinct on (e.request_id) e.request_id, e.body, e.created_at, u.display_name
         from approval_events e join users u on u.id = e.actor_user_id
        where e.org_id = $1 and e.kind = 'comment' and e.actor_user_id <> $2 and e.created_at > now() - interval '14 days'
        order by e.request_id, e.created_at desc)
     ${ROW_SQL.replace("from approval_requests r", "")},
            r.created_at, r.submitted_by, lc.body as c_body, lc.created_at as c_at, lc.display_name as c_name, a.acked_at
       from approval_requests r
       left join lastc lc on lc.request_id = r.id
       left join approval_acks a on a.request_id = r.id and a.user_id = $2
      where r.org_id = $1
        and ((r.status = 'pending' and (r.decide_by <= $3::date + 1 or (r.created_at > now() - interval '14 days' and r.submitted_by <> $2)))
             or lc.request_id is not null)
      order by greatest(r.created_at, coalesce(lc.created_at, r.created_at)) desc
      limit 40`, [user.orgId, user.id, today]);
  return rows.map((r) => {
    const req = toRow(r);
    const due = req.status === "pending" && req.decideBy <= addDays(today, 1);
    const type: NotifCard["type"] = r.c_at ? "comment" : due ? "due" : "new";
    const at: Date = r.c_at ?? r.created_at;
    const acked = !!r.acked_at && r.acked_at >= at;
    return { key: `${type}:${req.id}`, type, request: req, at, unread: !acked, acked,
      lastComment: r.c_at ? { name: r.c_name, body: r.c_body, at: r.c_at } : null, mine: r.submitted_by === user.id };
  }).sort((a, b) => (a.type === "due" ? 0 : 1) - (b.type === "due" ? 0 : 1) || b.at.getTime() - a.at.getTime());
}

export async function unreadCount(user: CurrentUser): Promise<number> {
  return (await notificationCards(user)).filter((c) => c.unread).length;
}

/** Members who receive "new request" notices: everyone in the org who may decide, except the actor. */
export async function deciders(orgId: string, exceptUserId: string): Promise<string[]> {
  const { rows } = await db().query(
    `select distinct m.user_id from memberships m join users u on u.id = m.user_id
       join role_permissions rp on rp.role_key = m.role_key and rp.permission_key = 'approvals.decide'
      where m.org_id = $1 and u.status = 'active' and m.user_id <> $2`, [orgId, exceptUserId]);
  return rows.map((r) => r.user_id);
}

// ---------------------------------------------------------------- influencers across requests
export type PersonCard = Person & { requestId: string; refNo: number; requestTitle: string; decideBy: string; requestStatus: MkStatus };

export async function listPeople(user: CurrentUser, tab: "pending" | "approved"): Promise<{ people: PersonCard[]; counts: { pending: number; approved: number } }> {
  const [list, counts] = await Promise.all([
    db().query(
      `select p.*, to_char(p.deliver_by, 'YYYY-MM-DD') as deliver_by_s, u.display_name as decider_name,
              r.id as request_id, r.ref_no, r.title as request_title, to_char(r.decide_by, 'YYYY-MM-DD') as decide_by, r.status as request_status
         from approval_people p join approval_requests r on r.id = p.request_id
         left join users u on u.id = p.decided_by
        where p.org_id = $1 and p.status = $2 and ($2 = 'approved' or r.status = 'pending')
        order by ${tab === "pending" ? "r.decide_by, r.ref_no, p.sort_order" : "p.decided_at desc nulls last, p.sort_order"}
        limit 200`, [user.orgId, tab]),
    db().query(
      `select count(*) filter (where p.status = 'pending' and r.status = 'pending')::int as pending,
              count(*) filter (where p.status = 'approved')::int as approved
         from approval_people p join approval_requests r on r.id = p.request_id where p.org_id = $1`, [user.orgId]),
  ]);
  return {
    people: list.rows.map((p) => ({
      id: p.id, name: p.name, platform: p.platform, handle: p.handle, followers: p.followers, feeSatang: p.fee_satang === null ? null : Number(p.fee_satang),
      avgViews: p.avg_views, engagementBps: p.engagement_bps, audience: p.audience, deliverables: p.deliverables, deliverBy: p.deliver_by_s,
      conditions: p.conditions, fitNote: p.fit_note, photoUrl: p.photo_url, profileUrl: p.profile_url, status: p.status,
      decidedByName: p.decider_name, decidedAt: p.decided_at,
      requestId: p.request_id, refNo: p.ref_no, requestTitle: p.request_title, decideBy: p.decide_by, requestStatus: p.request_status,
    })),
    counts: counts.rows[0],
  };
}
