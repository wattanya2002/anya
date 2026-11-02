import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BrandMark } from "@/components/icons";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

/** One-time owner bootstrap. Exists only while SETUP_TOKEN is configured AND no user exists yet. */
export default async function SetupPage() {
  if (!process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 24) notFound();
  const { rows } = await db().query("select exists(select 1 from users) as has_users");
  if (rows[0].has_users) notFound();
  return (
    <main className="auth">
      <section className="card auth-card" aria-labelledby="setup-title">
        <div className="brand"><BrandMark className="brand-mark" /><span className="brand-name">Wonder<br />Courts</span></div>
        <div>
          <h1 id="setup-title">ตั้งค่าบัญชีผู้ดูแลระบบครั้งแรก</h1>
          <p>หน้านี้ใช้ได้ครั้งเดียว และจะปิดอัตโนมัติเมื่อสร้างบัญชีแรกแล้ว</p>
        </div>
        <SetupForm />
      </section>
    </main>
  );
}
