import "server-only";
import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { listProducts } from "@/lib/inventory";
import { NAV } from "@/lib/nav";
import { MANUAL_SQL } from "@/lib/calendar-sql";
import {
  addDays, expandOccurrences, findConflicts, manualStatus, thaiDate, type CalItem, type CalKind, type CalStatus, type Repeat, type Visibility,
} from "@/lib/calendar-core";

export type Member = { id: string; name: string };

export async function listMembers(orgId: string): Promise<Member[]> {
  const { rows } = await db().query(
    `select u.id, u.display_name as name from memberships m join users u on u.id = m.user_id
      where m.org_id = $1 and u.status = 'active' order by u.display_name`, [orgId]);
  return rows;
}

type ManualRow = {
  id: string; title: string; kind: CalKind; start: string; end: string; all_day: boolean; start_time: string | null; end_time: string | null;
  repeat: Repeat; repeat_until: string | null; owner_user_id: string | null; owner_name: string | null; created_by: string;
  status: CalStatus; remind_minutes: number | null; details: string | null; link_url: string | null; visibility: Visibility;
};

function canEdit(user: CurrentUser, r: { created_by: string; owner_user_id: string | null }) {
  return can(user, "calendar.manage") && (r.created_by === user.id || r.owner_user_id === user.id || can(user, "admin.manage"));
}

function manualHref(kind: CalKind, link: string | null): { href: string | null; label: string | null } {
  if (kind === "stock") return { href: "/inventory", label: "เปิด Inventory" };
  if (kind === "promotion") return { href: NAV.promotion.href, label: "เปิดหน้าโปรโมชั่น" };
  if (kind === "content") return link ? { href: link, label: "เปิดไฟล์ / แคปชัน" } : { href: null, label: null };
  return { href: null, label: null };
}

function fromManual(user: CurrentUser, r: ManualRow): CalItem {
  const h = manualHref(r.kind, r.link_url);
  return {
    key: `ev:${r.id}`, sourceKey: `ev:${r.id}`, source: "manual", kind: r.kind, title: r.title,
    start: r.start, end: r.end, startTime: r.start_time, endTime: r.end_time,
    status: r.status, ownerId: r.owner_user_id, ownerName: r.owner_name, createdBy: r.created_by,
    href: h.href, hrefLabel: h.label, editable: canEdit(user, r), details: r.details, linkUrl: r.link_url,
    remindMinutes: r.remind_minutes, repeat: r.repeat, repeatUntil: r.repeat_until, visibility: r.visibility,
    occurrenceOf: r.start,
  };
}

/** Every calendar item the user may see in [from, to]: manual items plus live views of tasks, promotions, campaigns and stock. */
export async function loadCalendarItems(user: CurrentUser, from: string, to: string, onlyId: string | null = null): Promise<CalItem[]> {
  const today = bangkokToday();
  const items: CalItem[] = [];
  const manual = await db().query(MANUAL_SQL, [user.orgId, from, to, user.id, can(user, "calendar.view_executive"), can(user, "crm.followup"), onlyId]);
  for (const r of manual.rows as ManualRow[]) {
    const base = fromManual(user, r);
    for (const occ of expandOccurrences(base, from, to)) {
      items.push({ ...occ, key: `${base.key}:${occ.start}`, status: manualStatus(occ.kind, occ.status, occ.end, today) });
    }
  }
  if (onlyId) return items;

  const tasks = await db().query(
    `select t.id, t.title, t.due_date::text as due, to_char(t.due_time, 'HH24:MI') as due_time, t.status, t.owner_user_id, u.display_name as owner_name, t.created_by
       from tasks t left join users u on u.id = t.owner_user_id
      where t.org_id = $1 and t.due_date between $2::date and $3::date`, [user.orgId, from, to]);
  for (const t of tasks.rows) {
    const status: CalStatus = t.status === "done" ? "done" : t.status === "cancelled" ? "cancelled" : t.due < today ? "overdue" : "planned";
    items.push({
      key: `task:${t.id}`, sourceKey: `task:${t.id}`, source: "task", kind: "task", title: t.title, start: t.due, end: t.due,
      startTime: t.due_time, endTime: null, status, ownerId: t.owner_user_id, ownerName: t.owner_name, createdBy: t.created_by,
      href: "/", hrefLabel: "ไปที่งานวันนี้", editable: false,
    });
  }

  if (can(user, "promotions.view")) {
    const promos = await db().query(
      `select id, name, status, (starts_at at time zone 'Asia/Bangkok')::date::text as start,
              coalesce((ends_at at time zone 'Asia/Bangkok')::date, (starts_at at time zone 'Asia/Bangkok')::date)::text as "end", created_by
         from promotions
        where org_id = $1 and starts_at is not null and status not in ('rejected', 'cancelled')
          and (starts_at at time zone 'Asia/Bangkok')::date <= $3::date
          and coalesce((ends_at at time zone 'Asia/Bangkok')::date, (starts_at at time zone 'Asia/Bangkok')::date) >= $2::date`,
      [user.orgId, from, to]);
    const map: Record<string, CalStatus> = { draft: "planned", pending_approval: "pending_approval", approved: "planned", live: "in_progress", expired: "done" };
    for (const p of promos.rows) {
      items.push({
        key: `promo:${p.id}`, sourceKey: `promo:${p.id}`, source: "promotion", kind: "promotion", title: p.name, start: p.start, end: p.end,
        startTime: null, endTime: null, status: map[p.status] ?? "planned", ownerId: null, ownerName: null, createdBy: p.created_by,
        href: NAV.promotion.href, hrefLabel: "เปิดหน้าโปรโมชั่น", editable: false,
      });
    }
  }

  if (can(user, "marketing.view")) {
    const camps = await db().query(
      `select c.id, c.name, c.status, c.starts_on::text as start, coalesce(c.ends_on, c.starts_on)::text as "end",
              c.owner_user_id, u.display_name as owner_name, c.created_by
         from campaigns c left join users u on u.id = c.owner_user_id
        where c.org_id = $1 and c.starts_on is not null and c.starts_on <= $3::date and coalesce(c.ends_on, c.starts_on) >= $2::date`,
      [user.orgId, from, to]);
    const map: Record<string, CalStatus> = { draft: "planned", approval: "pending_approval", live: "in_progress", ended: "done" };
    for (const c of camps.rows) {
      items.push({
        key: `camp:${c.id}`, sourceKey: `camp:${c.id}`, source: "campaign", kind: "campaign", title: `แคมเปญ: ${c.name}`, start: c.start, end: c.end,
        startTime: null, endTime: null, status: map[c.status] ?? "planned", ownerId: c.owner_user_id, ownerName: c.owner_name, createdBy: c.created_by,
        href: NAV.marketing.href, hrefLabel: "เปิดหน้า Marketing", editable: false,
      });
    }
  }

  if (can(user, "inventory.view") && today >= from && today <= to) {
    const attention = (await listProducts(user.orgId)).filter((p) => p.status !== "ok");
    if (attention.length) {
      items.push({
        key: "stock:attention", sourceKey: "stock:attention", source: "stock", kind: "stock", title: `ต้องสั่งสินค้าเพิ่ม ${attention.length} รายการ`,
        start: today, end: today, startTime: null, endTime: null, status: "planned", ownerId: null, ownerName: null, createdBy: null,
        href: "/inventory/products?status=attention", hrefLabel: "ดูรายการที่ต้องสั่ง", editable: false,
        details: attention.slice(0, 8).map((p) => `${p.name} (คงเหลือ ${p.total} ${p.unit})`).join("\n"),
      });
    }
  }
  return items;
}

export type Alert = { key: string; title: string; body: string; href: string; tone: "pink" | "amber" | "purple" | "blue" | "green" };

/** Smart alerts (RCM §B) for this user, computed from live data. */
export async function computeAlerts(user: CurrentUser, now = new Date()): Promise<Alert[]> {
  const today = bangkokToday(now);
  const items = await loadCalendarItems(user, addDays(today, -30), addDays(today, 7));
  const mine = (i: CalItem) => i.ownerId === user.id || (i.ownerId === null && i.createdBy === user.id);
  const alerts: Alert[] = [];
  for (const i of items) {
    const at = `/calendar?view=day&date=${i.start}&item=${encodeURIComponent(i.sourceKey)}`;
    if (i.source === "promotion" && (i.status === "in_progress" || i.status === "planned") && i.end >= today && i.end <= addDays(today, 3)) {
      alerts.push({ key: `promo-ending:${i.sourceKey}:${i.end}`, title: "โปรใกล้หมดอายุ", body: `${i.title} สิ้นสุด${i.end === today ? "วันนี้" : ` ${thaiDate(i.end, { weekday: true })}`}`, href: at, tone: "pink" });
    }
    if (i.status === "overdue" && (i.source === "task" || i.source === "manual") && mine(i)) {
      alerts.push({ key: `overdue:${i.key}`, title: "งานเลยกำหนด", body: `${i.title} (กำหนด ${thaiDate(i.end, { weekday: true })})`, href: at, tone: "amber" });
    }
    if (i.source === "manual" && i.kind === "content" && i.status === "planned" && i.start <= today && i.end >= today) {
      alerts.push({ key: `content-due:${i.key}`, title: "ถึงวันโพสต์แต่ยังไม่อนุมัติ", body: i.title, href: at, tone: "blue" });
    }
    if (i.source === "manual" && i.kind === "stock" && i.start === today && i.status !== "done" && i.status !== "cancelled") {
      alerts.push({ key: `stock-due:${i.key}`, title: "ถึงกำหนดรับสินค้า/สั่งของ", body: i.title, href: at, tone: "green" });
    }
    if (i.source === "manual" && i.remindMinutes != null && mine(i) && i.status !== "done" && i.status !== "cancelled" && i.start >= today) {
      const startAt = Date.parse(`${i.start}T${i.startTime ?? "08:00"}:00+07:00`);
      const fireAt = startAt - i.remindMinutes * 60_000;
      if (now.getTime() >= fireAt && now.getTime() < startAt + 60 * 60_000) {
        alerts.push({ key: `remind:${i.key}`, title: "แจ้งเตือนรายการ", body: `${i.title} · ${i.start === today ? "วันนี้" : thaiDate(i.start, { weekday: true })}${i.startTime ? ` ${i.startTime}` : ""}`, href: at, tone: "purple" });
      }
    }
  }
  return alerts;
}

const lastSync = new Map<string, number>();

/** Copies new alerts into in-app notifications (one per user + alert key). Throttled per instance; never throws. */
export async function syncCalendarAlerts(user: CurrentUser): Promise<void> {
  if (!can(user, "calendar.view")) return;
  const now = Date.now();
  if ((lastSync.get(user.id) ?? 0) > now - 5 * 60_000) return;
  lastSync.set(user.id, now);
  try {
    const alerts = await computeAlerts(user);
    for (const a of alerts) {
      await db().query(
        `insert into notifications (org_id, user_id, title, body, href, dedupe_key) values ($1,$2,$3,$4,$5,$6)
         on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`,
        [user.orgId, user.id, a.title, a.body, a.href, a.key]);
    }
  } catch (err) {
    console.error("calendar alert sync failed", err);
  }
}

export function conflictsIn(items: CalItem[]) { return findConflicts(items); }

export type EditableEvent = {
  id: string; title: string; kind: CalKind; start: string; end: string; allDay: boolean; startTime: string | null; endTime: string | null;
  repeat: Repeat; repeatUntil: string | null; ownerId: string | null; status: CalStatus; remindMinutes: number | null;
  details: string | null; linkUrl: string | null; visibility: Visibility;
};

/** A manual item the user may edit (same visibility rules as the calendar, plus creator/owner/admin). */
export async function getEditableEvent(user: CurrentUser, id: string): Promise<EditableEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await db().query(MANUAL_SQL.replace("and e.starts_on <= $3::date", "and $2::date is null and $3::date is null")
    .replace("and (e.ends_on >= $2::date or (e.repeat <> 'none' and (e.repeat_until is null or e.repeat_until >= $2::date)))", ""),
    [user.orgId, null, null, user.id, can(user, "calendar.view_executive"), can(user, "crm.followup"), id]);
  const r = rows[0] as ManualRow | undefined;
  if (!r || !canEdit(user, r)) return null;
  return {
    id: r.id, title: r.title, kind: r.kind, start: r.start, end: r.end, allDay: r.all_day, startTime: r.start_time, endTime: r.end_time,
    repeat: r.repeat, repeatUntil: r.repeat_until, ownerId: r.owner_user_id, status: r.status, remindMinutes: r.remind_minutes,
    details: r.details, linkUrl: r.link_url, visibility: r.visibility,
  };
}
