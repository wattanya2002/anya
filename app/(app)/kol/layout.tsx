import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { kolReady } from "@/lib/kol";
import "@/components/kol/kol.css";

/** KOL module inside the existing back-office shell. First visit creates the KOL campaign, terms v1 and the two starting forms. */
export default async function KolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowed = can(user, "kol.view") || can(user, "forms.manage") || can(user, "forms.responses");
  if (!allowed) {
    return (
      <section className="card page" aria-labelledby="kol-denied">
        <h1 id="kol-denied">ไม่มีสิทธิ์เข้าถึง KOL</h1>
        <p>บทบาท “{user.roleNameTh}” ไม่มีสิทธิ์ดูข้อมูลผู้สมัคร KOL กรุณาติดต่อผู้ดูแลระบบ</p>
        <p><Link href="/">กลับหน้าหลัก</Link></p>
      </section>
    );
  }
  await kolReady(user);
  return <div className="kol">{children}</div>;
}
