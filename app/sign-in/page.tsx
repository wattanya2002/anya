import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { BrandMark } from "@/components/icons";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next); // e.g. a CEO card link opened before signing in
  if (await getCurrentUser()) redirect(next ?? "/");
  return (
    <main className="auth">
      <section className="card auth-card" aria-labelledby="signin-title">
        <div className="brand"><BrandMark className="brand-mark" /><span className="brand-name">Wonder<br />Courts</span></div>
        <div>
          <h1 id="signin-title">เข้าสู่ระบบหลังบ้าน</h1>
          <p>สำหรับทีมงานที่ได้รับสิทธิ์เท่านั้น</p>
        </div>
        <SignInForm next={next} />
      </section>
    </main>
  );
}
