import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Rail, BottomNav } from "@/components/rail";
import { Topbar } from "@/components/topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { rows } = await db().query(
    `select id, title, body, href, read_at is not null as read from notifications
      where user_id = $1 and org_id = $2 order by created_at desc limit 8`,
    [user.id, user.orgId],
  );
  return (
    <div className="frame">
      <Rail />
      <main className="content" id="main">
        <Topbar user={user} notifications={rows} />
        {user.mustChangePassword && (
          <p className="notice" role="status">
            บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานจริง <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link>
          </p>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
