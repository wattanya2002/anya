"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { getCurrentUser, can, type CurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { getEditableEvent, listMembers, loadCalendarItems } from "@/lib/calendar";
import { addDays, findConflicts, thaiDate, timeLabel, validateEventInput } from "@/lib/calendar-core";
import type { FormState } from "@/app/actions";

async function writer(): Promise<CurrentUser | string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, "calendar.manage")) return "ไม่มีสิทธิ์เพิ่มหรือแก้ไขรายการในปฏิทิน";
  return user;
}

const fieldsOf = (f: FormData) => Object.fromEntries([...f.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

async function audit(c: PoolClient, u: CurrentUser, action: string, id: string, before: unknown, after: unknown) {
  await c.query(
    `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, before, after) values ($1,$2,$3,'calendar_event',$4,$5,$6)`,
    [u.orgId, u.id, action, id, before ?? null, after ?? null]);
}

export async function saveCalendarEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  const members = await listMembers(u.orgId);
  const v = validateEventInput(fields, { memberIds: members.map((m) => m.id), canFollowup: can(u, "crm.followup") });
  if ("error" in v) return { error: v.error, fields };
  const e = v.value;
  const id = fields.id || "";
  try {
    if (id && !(await getEditableEvent(u, id))) return { error: "ไม่พบรายการ หรือไม่มีสิทธิ์แก้ไข", fields };
    const values = [u.orgId, e.title, e.kind, e.start, e.end, e.allDay, e.startTime, e.endTime, e.repeat, e.repeatUntil,
      e.ownerId, e.status, e.remindMinutes, e.details, e.linkUrl, e.visibility, u.id];
    const savedId = await withTransaction(async (c) => {
      if (id) {
        const before = await c.query(`select * from calendar_events where id = $1 and org_id = $2 for update`, [id, u.orgId]);
        if (!before.rows[0]) throw new Error("not found");
        await c.query(
          `update calendar_events set title=$2, kind=$3, starts_on=$4, ends_on=$5, all_day=$6, start_time=$7, end_time=$8, repeat=$9, repeat_until=$10,
                  owner_user_id=$11, status=$12, remind_minutes=$13, details=$14, link_url=$15, visibility=$16, updated_by=$17, updated_at=now()
            where id=$18 and org_id=$1`, [...values, id]);
        await audit(c, u, "calendar_event.updated", id, before.rows[0], e);
        return id;
      }
      const ins = await c.query(
        `insert into calendar_events (org_id, title, kind, starts_on, ends_on, all_day, start_time, end_time, repeat, repeat_until,
                                      owner_user_id, status, remind_minutes, details, link_url, visibility, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`, values);
      await audit(c, u, "calendar_event.created", ins.rows[0].id, null, e);
      return ins.rows[0].id as string;
    });

    // Conflict detection (RCM §C): compare with the responsible person's timed items they can see.
    let warn: string | undefined;
    if (e.startTime) {
      const who = e.ownerId ?? u.id;
      const items = (await loadCalendarItems(u, e.start, addDays(e.end, 0)))
        .filter((i) => i.ownerId === who || (i.ownerId === null && i.createdBy === who));
      const clashes = findConflicts(items)
        .filter(([a, b]) => a.sourceKey === `ev:${savedId}` || b.sourceKey === `ev:${savedId}`)
        .map(([a, b]) => (a.sourceKey === `ev:${savedId}` ? b : a));
      if (clashes.length) {
        warn = `เวลาซ้อนกับ: ${clashes.slice(0, 3).map((c) => `${c.title} (${thaiDate(c.start)} ${timeLabel(c)})`).join(", ")}${clashes.length > 3 ? ` และอีก ${clashes.length - 3} รายการ` : ""}`;
      }
    }
    revalidatePath("/calendar", "layout");
    return { ok: id ? "บันทึกการแก้ไขแล้ว" : `เพิ่ม “${e.title}” ในปฏิทินแล้ว`, warn, nonce: savedId + Date.now() };
  } catch (err) {
    const pg = err as { code?: string };
    if (pg?.code === "23514") return { error: "ข้อมูลบางช่องไม่อยู่ในรูปแบบที่กำหนด", fields };
    console.error("calendar save failed", err);
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่", fields };
  }
}

export async function deleteCalendarEvent(form: FormData): Promise<void> {
  const u = await writer();
  if (typeof u === "string") return;
  const id = String(form.get("id") ?? "");
  const back = String(form.get("back") ?? "/calendar");
  if (!(await getEditableEvent(u, id))) return;
  await withTransaction(async (c) => {
    const before = await c.query(`delete from calendar_events where id = $1 and org_id = $2 returning *`, [id, u.orgId]);
    if (before.rows[0]) await audit(c, u, "calendar_event.deleted", id, before.rows[0], null);
  });
  revalidatePath("/calendar", "layout");
  redirect(back.startsWith("/calendar") ? back : "/calendar");
}

export async function setCalendarEventStatus(form: FormData): Promise<void> {
  const u = await writer();
  if (typeof u === "string") return;
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!["planned", "in_progress", "done", "cancelled"].includes(status)) return;
  if (!(await getEditableEvent(u, id))) return;
  await withTransaction(async (c) => {
    const before = await c.query(`select status from calendar_events where id = $1 and org_id = $2 for update`, [id, u.orgId]);
    await c.query(`update calendar_events set status = $3, updated_by = $4, updated_at = now() where id = $1 and org_id = $2`, [id, u.orgId, status, u.id]);
    await audit(c, u, "calendar_event.status", id, before.rows[0], { status });
  });
  revalidatePath("/calendar", "layout");
}
