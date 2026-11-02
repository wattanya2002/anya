import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandMark } from "@/components/icons";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="auth">
      <section className="card auth-card" aria-labelledby="signin-title">
        <div className="brand"><BrandMark className="brand-mark" /><span className="brand-name">Wonder<br />Courts</span></div>
        <div>
          <h1 id="signin-title">เข้าสู่ระบบหลังบ้าน</h1>
          <p>สำหรับทีมงานที่ได้รับสิทธิ์เท่านั้น</p>
        </div>
        <SignInForm />
      </section>
    </main>
  );
}
