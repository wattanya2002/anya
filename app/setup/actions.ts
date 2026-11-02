"use server";

import { timingSafeEqual, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db, withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { FormState } from "@/app/actions";

const schema = z.object({
  org: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดง").max(80),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  password: z.string().min(12, "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร").max(200),
});

const digest = (v: string) => createHash("sha256").update(v).digest();

export async function completeSetup(_prev: FormState, form: FormData): Promise<FormState> {
  const expected = process.env.SETUP_TOKEN;
  const fields = { org: String(form.get("org") ?? ""), name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!expected || expected.length < 24) return { error: "หน้าตั้งค่าถูกปิดแล้ว" };

  const ip = ((await headers()).get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const recent = await db().query(
    "select count(*)::int as n from login_attempts where ip = $1 and succeeded = false and attempted_at > now() - interval '15 minutes'",
    [ip],
  );
  if (recent.rows[0].n >= 5) return { error: "พยายามหลายครั้งเกินไป กรุณารอ 15 นาที", fields };

  const token = String(form.get("token") ?? "");
  if (!timingSafeEqual(digest(token), digest(expected))) {
    await db().query("insert into login_attempts (ip, email, succeeded) values ($1, 'setup', false)", [ip]);
    return { error: "รหัสตั้งค่าไม่ถูกต้อง", fields };
  }
  const parsed = schema.safeParse({ ...fields, password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const hash = await hashPassword(parsed.data.password);

  const created = await withTransaction(async (c) => {
    await c.query("lock table users in share row exclusive mode"); // serialize concurrent setup attempts
    const exists = await c.query("select exists(select 1 from users) as e");
    if (exists.rows[0].e) return false;
    let org = (await c.query("select id from organizations where is_demo = false order by created_at limit 1")).rows[0];
    if (!org) org = (await c.query("insert into organizations (name) values ($1) returning id", [parsed.data.org])).rows[0];
    const u = await c.query(
      "insert into users (email, display_name, password_hash, must_change_password) values ($1, $2, $3, $4) returning id",
      [parsed.data.email, parsed.data.name, hash, form.get("mustChange") === "on"],
    );
    await c.query("insert into memberships (org_id, user_id, role_key) values ($1, $2, 'owner')", [org.id, u.rows[0].id]);
    await c.query(
      "insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, source) values ($1, $2::uuid, 'user.created_owner', 'user', $2::text, 'setup')",
      [org.id, u.rows[0].id],
    );
    return true;
  });
  if (!created) return { error: "ระบบถูกตั้งค่าไปแล้ว" };
  redirect("/sign-in");
}
