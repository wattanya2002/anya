"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can, getCurrentUser } from "@/lib/auth";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { bangkokToday } from "@/lib/dates";

export type FormState = { error?: string; ok?: string; nonce?: string; fields?: Record<string, string> };

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

// ------------------------------------------------------------------ auth
const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("กรุณากรอกอีเมลให้ถูกต้อง").max(200),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };

  const ip = await clientIp();
  const recent = await db().query(
    `select count(*)::int as n from login_attempts
      where ip = $1 and succeeded = false and attempted_at > now() - interval '15 minutes'`,
    [ip],
  );
  if (recent.rows[0].n >= 5) {
    return { error: "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่", fields: { email } };
  }

  const { rows } = await db().query(
    `select id, password_hash, status, session_version from users where email = $1`,
    [parsed.data.email],
  );
  const user = rows[0];
  const ok = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY_HASH);
  const success = Boolean(user && ok && user.status === "active");
  await db().query(`insert into login_attempts (ip, email, succeeded) values ($1, $2, $3)`, [ip, parsed.data.email, success]);
  if (!success) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", fields: { email } };

  if (recent.rows[0].n > 0) await db().query(`delete from login_attempts where ip = $1 and succeeded = false`, [ip]);
  await db().query(`update users set last_login_at = now() where id = $1`, [user.id]);
  const session = await getSession();
  session.userId = user.id;
  session.sessionVersion = user.session_version;
  await session.save();
  redirect("/");
}

export async function signOut() {
  const session = await getSession();
  session.destroy();
  redirect("/sign-in");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    next: z.string().min(12, "รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "ยืนยันรหัสผ่านไม่ตรงกัน", path: ["confirm"] });

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const parsed = passwordSchema.safeParse({ current: form.get("current"), next: form.get("next"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { rows } = await db().query(`select password_hash from users where id = $1`, [user.id]);
  if (!(await verifyPassword(parsed.data.current, rows[0].password_hash))) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  const hash = await hashPassword(parsed.data.next);
  const version = await withTransaction(async (c) => {
    const r = await c.query(
      `update users set password_hash = $2, must_change_password = false, session_version = session_version + 1
        where id = $1 returning session_version`,
      [user.id, hash],
    );
    await c.query(
      `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id) values ($1, $2::uuid, 'user.password_changed', 'user', $2::text)`,
      [user.orgId, user.id],
    );
    return r.rows[0].session_version as number;
  });
  const session = await getSession();
  session.sessionVersion = version; // other sessions are invalidated
  await session.save();
  return { ok: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}

// ------------------------------------------------------------------ tasks
const idSchema = z.string().uuid();

export async function setTaskDone(taskId: string, done: boolean): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };
  if (!can(user, "tasks.manage")) return { error: "ไม่มีสิทธิ์แก้ไขงาน" };
  if (!idSchema.safeParse(taskId).success) return { error: "ไม่พบงาน" };
  const result = await withTransaction(async (c) => {
    const before = await c.query(`select status from tasks where id = $1 and org_id = $2 for update`, [taskId, user.orgId]);
    if (!before.rows[0]) return "missing" as const;
    const next = done ? "done" : "open";
    if (before.rows[0].status === next) return "unchanged" as const; // idempotent
    await c.query(
      `update tasks set status = $3, completed_at = case when $3 = 'done' then now() end,
              completed_by = case when $3 = 'done' then $4::uuid end, updated_at = now()
        where id = $1 and org_id = $2`,
      [taskId, user.orgId, next, user.id],
    );
    await c.query(
      `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, before, after)
       values ($1, $2, 'task.status_changed', 'task', $3, $4, $5)`,
      [user.orgId, user.id, taskId, { status: before.rows[0].status }, { status: next }],
    );
    return "ok" as const;
  });
  if (result === "missing") return { error: "ไม่พบงาน หรือคุณไม่มีสิทธิ์เข้าถึง" };
  revalidatePath("/");
  return {};
}

const taskSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกชื่องาน").max(200, "ชื่องานยาวเกิน 200 ตัวอักษร"),
  dueTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง")]),
});

export async function createTodayTask(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const fields = { title: String(form.get("title") ?? ""), dueTime: String(form.get("dueTime") ?? "") };
  if (!can(user, "tasks.manage")) return { error: "ไม่มีสิทธิ์สร้างงาน", fields };
  const parsed = taskSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const id = await withTransaction(async (c) => {
    const r = await c.query(
      `insert into tasks (org_id, title, due_date, due_time, owner_user_id, created_by)
       values ($1, $2, $3, nullif($4, '')::time, $5, $5) returning id`,
      [user.orgId, parsed.data.title, bangkokToday(), parsed.data.dueTime, user.id],
    );
    await c.query(
      `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, after)
       values ($1, $2, 'task.created', 'task', $3, $4)`,
      [user.orgId, user.id, r.rows[0].id, { title: parsed.data.title, due_time: parsed.data.dueTime || null }],
    );
    return r.rows[0].id as string;
  });
  revalidatePath("/");
  return { ok: "เพิ่มงานแล้ว", nonce: id };
}

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await db().query(`update notifications set read_at = now() where user_id = $1 and org_id = $2 and read_at is null`, [user.id, user.orgId]);
  revalidatePath("/");
}
