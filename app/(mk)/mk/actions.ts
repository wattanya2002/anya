"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { getCurrentUser, can, type CurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { deciders } from "@/lib/mk";
import { cleanText, refLabel, validateRequestInput, type RequestInput } from "@/lib/mk-core";
import type { FormState } from "@/app/actions";

async function actor(permission: string): Promise<CurrentUser | string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, permission)) return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
  return user;
}

const fieldsOf = (f: FormData) => Object.fromEntries([...f.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function audit(c: PoolClient, u: CurrentUser, action: string, id: string, before: unknown, after: unknown) {
  await c.query(
    `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, before, after) values ($1,$2,$3,'approval_request',$4,$5,$6)`,
    [u.orgId, u.id, action, id, before ?? null, after ?? null]);
}

async function notify(c: PoolClient, orgId: string, userIds: string[], title: string, body: string, href: string, dedupe: string) {
  for (const uid of [...new Set(userIds)]) {
    await c.query(
      `insert into notifications (org_id, user_id, title, body, href, dedupe_key) values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`, [orgId, uid, title, body, href, `${dedupe}:${uid}`]);
  }
}

function requestValues(v: RequestInput) {
  return [v.kind, v.title, v.summary, v.amountSatang, v.channel, v.goal, v.adCopy, v.plan, v.discountText, v.conditions,
    v.startsOn, v.endsOn, v.allDay, v.startTime, v.endTime, v.decideBy, v.urgent, v.travelMinutes, v.repeat, v.remindOn, v.remindTime,
    v.remindBefore, v.remindLocation, v.remindMessaging, v.calendarList, v.invitees, v.tags, v.flagged, v.priority, v.note, v.linkUrl];
}

async function writeChildren(c: PoolClient, u: CurrentUser, id: string, v: RequestInput) {
  await c.query(`delete from approval_attachments where request_id = $1 and org_id = $2`, [id, u.orgId]);
  for (const [i, a] of v.attachments.entries()) {
    await c.query(`insert into approval_attachments (org_id, request_id, kind, label, url, sort_order, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
      [u.orgId, id, a.kind, a.label, a.url, i, u.id]);
  }
  // People keep their decisions when the list is edited: match by name, add new ones, remove missing pending ones.
  const existing = (await c.query(`select id, name, status from approval_people where request_id = $1 and org_id = $2`, [id, u.orgId])).rows;
  const keep = new Set<string>();
  for (const [i, p] of v.people.entries()) {
    const match = existing.find((e) => e.name === p.name && !keep.has(e.id));
    const vals = [p.name, p.platform, p.handle, p.followers, p.feeSatang, p.avgViews, p.engagementBps, p.audience, p.deliverables, p.deliverBy,
      p.conditions, p.fitNote, p.photoUrl, p.profileUrl, i];
    if (match) {
      keep.add(match.id);
      await c.query(
        `update approval_people set name=$1, platform=$2, handle=$3, followers=$4, fee_satang=$5, avg_views=$6, engagement_bps=$7, audience=$8,
                deliverables=$9, deliver_by=$10, conditions=$11, fit_note=$12, photo_url=$13, profile_url=$14, sort_order=$15
          where id = $16 and org_id = $17`, [...vals, match.id, u.orgId]);
    } else {
      await c.query(
        `insert into approval_people (name, platform, handle, followers, fee_satang, avg_views, engagement_bps, audience, deliverables, deliver_by,
                                      conditions, fit_note, photo_url, profile_url, sort_order, org_id, request_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [...vals, u.orgId, id]);
    }
  }
  const drop = existing.filter((e) => !keep.has(e.id) && e.status === "pending").map((e) => e.id);
  if (drop.length) await c.query(`delete from approval_people where id = any($1) and org_id = $2`, [drop, u.orgId]);
}

/** Team form: create a request, or edit (and resubmit) one the user submitted. */
export async function saveRequest(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await actor("approvals.submit");
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  const v = validateRequestInput(fields);
  if ("error" in v) return { error: v.error, fields: { ...fields, $field: v.field ?? "" } };
  const editId = fields.id && isUuid(fields.id) ? fields.id : null;
  let savedId = "";
  try {
    savedId = await withTransaction(async (c) => {
      if (editId) {
        const before = (await c.query(`select * from approval_requests where id = $1 and org_id = $2 for update`, [editId, u.orgId])).rows[0];
        if (!before) throw new Error("not-found");
        if (before.submitted_by !== u.id && !can(u, "admin.manage")) throw new Error("not-owner");
        if (before.status === "approved") throw new Error("decided");
        await c.query(
          `update approval_requests set kind=$1, title=$2, summary=$3, amount_satang=$4, channel=$5, goal=$6, ad_copy=$7, plan=$8, discount_text=$9,
                  conditions=$10, starts_on=$11, ends_on=$12, all_day=$13, start_time=$14, end_time=$15, decide_by=$16, urgent=$17, travel_minutes=$18,
                  repeat=$19, remind_on=$20, remind_time=$21, remind_before=$22, remind_location=$23, remind_messaging=$24, calendar_list=$25,
                  invitees=$26, tags=$27, flagged=$28, priority=$29, note=$30, link_url=$31,
                  status='pending', decided_by=null, decided_at=null, updated_at=now()
            where id = $32 and org_id = $33`, [...requestValues(v.value), editId, u.orgId]);
        await writeChildren(c, u, editId, v.value);
        if (before.status === "returned") {
          await c.query(`insert into approval_events (org_id, request_id, kind, body, actor_user_id) values ($1,$2,'resubmitted',$3,$4)`,
            [u.orgId, editId, "แก้ไขแล้วส่งอนุมัติอีกครั้ง", u.id]);
          await notify(c, u.orgId, await deciders(u.orgId, u.id), "คำขอที่แก้ไขแล้ว", `${refLabel(before.ref_no)} ${v.value.title}`, `/mk/requests/${editId}`, `apr:resub:${editId}:${Date.now()}`);
        }
        await audit(c, u, "approval_request.updated", editId, before, v.value);
        return editId;
      }
      const ins = await c.query(
        `insert into approval_requests (kind, title, summary, amount_satang, channel, goal, ad_copy, plan, discount_text, conditions, starts_on, ends_on,
                                        all_day, start_time, end_time, decide_by, urgent, travel_minutes, repeat, remind_on, remind_time, remind_before,
                                        remind_location, remind_messaging, calendar_list, invitees, tags, flagged, priority, note, link_url, org_id, submitted_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
         returning id, ref_no`, [...requestValues(v.value), u.orgId, u.id]);
      const { id, ref_no } = ins.rows[0];
      await writeChildren(c, u, id, v.value);
      await c.query(`insert into approval_events (org_id, request_id, kind, actor_user_id) values ($1,$2,'submitted',$3)`, [u.orgId, id, u.id]);
      await notify(c, u.orgId, await deciders(u.orgId, u.id), "คำขอใหม่รออนุมัติ", `${refLabel(ref_no)} ${v.value.title}`, `/mk/requests/${id}`, `apr:new:${id}`);
      await audit(c, u, "approval_request.created", id, null, v.value);
      return id as string;
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "not-found") return { error: "ไม่พบคำขอนี้", fields };
    if (msg === "not-owner") return { error: "แก้ไขได้เฉพาะคำขอที่คุณส่งเอง", fields };
    if (msg === "decided") return { error: "คำขอนี้อนุมัติแล้ว แก้ไขไม่ได้", fields };
    if ((err as { code?: string }).code === "23514") return { error: "ข้อมูลบางช่องไม่อยู่ในรูปแบบที่กำหนด", fields };
    console.error("approval save failed", err);
    return { error: "บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง", fields };
  }
  revalidatePath("/mk", "layout");
  redirect(`/mk/requests/${savedId}?saved=1`);
}

/** Comment on a request (optionally about one influencer). Idempotent per client key, so a retry never duplicates. */
export async function addComment(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await actor("approvals.view");
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  const id = fields.request_id ?? "";
  const personId = fields.person_id && isUuid(fields.person_id) ? fields.person_id : null;
  const body = cleanText(fields.body);
  if (!isUuid(id)) return { error: "ไม่พบคำขอนี้", fields };
  if (!body) return { error: "พิมพ์คอมเมนต์ก่อนส่ง (ไม่เกิน 2,000 ตัวอักษร)", fields };
  const key = (fields.client_key ?? "").slice(0, 64) || null;
  try {
    await withTransaction(async (c) => {
      const r = (await c.query(`select id, ref_no, title, submitted_by from approval_requests where id = $1 and org_id = $2`, [id, u.orgId])).rows[0];
      if (!r) throw new Error("not-found");
      const ins = await c.query(
        `insert into approval_events (org_id, request_id, person_id, kind, body, actor_user_id, client_key) values ($1,$2,$3,'comment',$4,$5,$6)
         on conflict (request_id, client_key) do nothing returning id`, [u.orgId, id, personId, body, u.id, key]);
      if (!ins.rows[0]) return; // already saved by an earlier attempt
      const others = (await c.query(
        `select distinct actor_user_id from approval_events where request_id = $1 and actor_user_id <> $2`, [id, u.id])).rows.map((x) => x.actor_user_id);
      const to = [r.submitted_by, ...others].filter((x) => x !== u.id);
      await notify(c, u.orgId, to, `${u.displayName} คอมเมนต์`, `${refLabel(r.ref_no)} ${body.slice(0, 80)}`, `/mk/requests/${id}#thread`, `apr:c:${ins.rows[0].id}`);
    });
  } catch (err) {
    if ((err as Error).message === "not-found") return { error: "ไม่พบคำขอนี้", fields };
    console.error("approval comment failed", err);
    return { error: "ส่งไม่สำเร็จ ข้อความยังอยู่", fields };
  }
  revalidatePath("/mk", "layout");
  return { ok: "ส่งคอมเมนต์แล้ว", nonce: String(Date.now()) };
}

/** Confirmed approval of a whole request (ads, promotions, other). Safe against double submit. */
export async function approveRequest(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await actor("approvals.decide");
  if (typeof u === "string") return { error: u };
  const id = String(form.get("request_id") ?? "");
  if (!isUuid(id)) return { error: "ไม่พบคำขอนี้" };
  let result = "ok" as "ok" | "decided" | "missing" | "people";
  try {
    await withTransaction(async (c) => {
      const r = (await c.query(`select * from approval_requests where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      if (!r) { result = "missing"; return; }
      if (r.status !== "pending") { result = "decided"; return; }
      if (r.kind === "influencer") { result = "people"; return; }
      await c.query(`update approval_requests set status='approved', decided_by=$3, decided_at=now(), updated_at=now() where id=$1 and org_id=$2`, [id, u.orgId, u.id]);
      await c.query(`insert into approval_events (org_id, request_id, kind, actor_user_id) values ($1,$2,'approved',$3)`, [u.orgId, id, u.id]);
      await notify(c, u.orgId, r.submitted_by === u.id ? [] : [r.submitted_by], "คำขอได้รับอนุมัติ", `${refLabel(r.ref_no)} ${r.title}`, `/mk/requests/${id}`, `apr:ok:${id}`);
      await audit(c, u, "approval_request.approved", id, { status: r.status }, { status: "approved" });
    });
  } catch (err) {
    console.error("approve failed", err);
    return { error: "บันทึกไม่สำเร็จ การอนุมัติยังไม่มีผล กรุณาลองอีกครั้ง" };
  }
  if (result === "missing") return { error: "ไม่พบคำขอนี้" };
  if (result === "people") return { error: "คำขออินฟลูเอนเซอร์ต้องอนุมัติทีละคนจากหน้ารายคน" };
  revalidatePath("/mk", "layout");
  redirect(`/mk/requests/${id}/done${result === "decided" ? "?already=1" : ""}`);
}

/** Approve one influencer. When everyone in the request is approved, the request becomes approved too. */
export async function approvePerson(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await actor("approvals.decide");
  if (typeof u === "string") return { error: u };
  const id = String(form.get("request_id") ?? "");
  const pid = String(form.get("person_id") ?? "");
  if (!isUuid(id) || !isUuid(pid)) return { error: "ไม่พบรายชื่อนี้" };
  let found = true as boolean;
  try {
    await withTransaction(async (c) => {
      const r = (await c.query(`select * from approval_requests where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      const p = r && (await c.query(`select * from approval_people where id = $1 and request_id = $2 and org_id = $3 for update`, [pid, id, u.orgId])).rows[0];
      if (!r || !p) { found = false; return; }
      if (p.status !== "pending") return;
      await c.query(`update approval_people set status='approved', decided_by=$2, decided_at=now() where id=$1`, [pid, u.id]);
      await c.query(`insert into approval_events (org_id, request_id, person_id, kind, actor_user_id) values ($1,$2,$3,'approved',$4)`, [u.orgId, id, pid, u.id]);
      const left = (await c.query(`select count(*)::int as n from approval_people where request_id = $1 and status = 'pending'`, [id])).rows[0].n;
      if (left === 0 && r.status !== "approved") {
        await c.query(`update approval_requests set status='approved', decided_by=$3, decided_at=now(), updated_at=now() where id=$1 and org_id=$2`, [id, u.orgId, u.id]);
      }
      await notify(c, u.orgId, r.submitted_by === u.id ? [] : [r.submitted_by], "อนุมัติอินฟลูเอนเซอร์แล้ว", `${refLabel(r.ref_no)} ${p.name}`, `/mk/requests/${id}`, `apr:p:${pid}`);
      await audit(c, u, "approval_person.approved", pid, { status: p.status }, { status: "approved", request_id: id });
    });
  } catch (err) {
    console.error("approve person failed", err);
    return { error: "บันทึกไม่สำเร็จ การอนุมัติยังไม่มีผล กรุณาลองอีกครั้ง" };
  }
  if (!found) return { error: "ไม่พบรายชื่อนี้" };
  revalidatePath("/mk", "layout");
  redirect(`/mk/requests/${id}/people/${pid}/done`);
}

/** Send a request back to the team with a required reason (kept in the history). */
export async function returnRequest(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await actor("approvals.decide");
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  const id = fields.request_id ?? "";
  const reason = cleanText(fields.reason);
  if (!isUuid(id)) return { error: "ไม่พบคำขอนี้", fields };
  if (!reason) return { error: "กรอกเหตุผลที่ส่งกลับ (ไม่เกิน 2,000 ตัวอักษร)", fields };
  let state = "ok" as "ok" | "decided" | "missing";
  try {
    await withTransaction(async (c) => {
      const r = (await c.query(`select * from approval_requests where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      if (!r) { state = "missing"; return; }
      if (r.status !== "pending") { state = "decided"; return; }
      await c.query(`update approval_requests set status='returned', decided_by=$3, decided_at=now(), decision_note=$4, updated_at=now() where id=$1 and org_id=$2`,
        [id, u.orgId, u.id, reason]);
      await c.query(`insert into approval_events (org_id, request_id, kind, body, actor_user_id) values ($1,$2,'returned',$3,$4)`, [u.orgId, id, reason, u.id]);
      await notify(c, u.orgId, r.submitted_by === u.id ? [] : [r.submitted_by], "คำขอถูกส่งกลับแก้ไข", `${refLabel(r.ref_no)} ${reason.slice(0, 80)}`, `/mk/requests/${id}`, `apr:ret:${id}:${Date.now()}`);
      await audit(c, u, "approval_request.returned", id, { status: r.status }, { status: "returned", reason });
    });
  } catch (err) {
    console.error("return failed", err);
    return { error: "ส่งไม่สำเร็จ ข้อความยังอยู่", fields };
  }
  if (state === "missing") return { error: "ไม่พบคำขอนี้", fields };
  if (state === "decided") return { error: "คำขอนี้ถูกตัดสินไปแล้ว", fields };
  revalidatePath("/mk", "layout");
  redirect(`/mk?tab=returned&done=returned`);
}

/** "รับทราบ" on a notification card. Marks it read for this user only; the request status does not change. */
export async function acknowledge(form: FormData): Promise<void> {
  const u = await actor("approvals.view");
  if (typeof u === "string") return;
  const id = String(form.get("request_id") ?? "");
  if (!isUuid(id)) return;
  await withTransaction(async (c) => {
    const ok = (await c.query(`select 1 from approval_requests where id = $1 and org_id = $2`, [id, u.orgId])).rows[0];
    if (!ok) return;
    await c.query(`insert into approval_acks (request_id, user_id) values ($1,$2) on conflict (request_id, user_id) do update set acked_at = now()`, [id, u.id]);
    await c.query(`update notifications set read_at = now() where user_id = $1 and org_id = $2 and read_at is null and href like $3`, [u.id, u.orgId, `/mk/requests/${id}%`]);
  });
  revalidatePath("/mk", "layout");
}

/** "อ่านทั้งหมด": acknowledge every request currently shown as a notification card for this user. */
export async function acknowledgeAll(form: FormData): Promise<void> {
  const u = await actor("approvals.view");
  if (typeof u === "string") return;
  const ids = String(form.get("ids") ?? "").split(",").filter(isUuid).slice(0, 100);
  if (!ids.length) return;
  await withTransaction(async (c) => {
    await c.query(
      `insert into approval_acks (request_id, user_id)
       select r.id, $2 from approval_requests r where r.id = any($1::uuid[]) and r.org_id = $3
       on conflict (request_id, user_id) do update set acked_at = now()`, [ids, u.id, u.orgId]);
    await c.query(`update notifications set read_at = now() where user_id = $1 and org_id = $2 and read_at is null and href like '/mk/%'`, [u.id, u.orgId]);
  });
  revalidatePath("/mk", "layout");
}
