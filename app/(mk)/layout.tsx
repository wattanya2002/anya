import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { Rail } from "@/components/rail";
import "./approvals.css";

export const dynamic = "force-dynamic";

/** MK (marketing approvals) shell: the main rail on iPad / PC, the MK screens fill the rest of the viewport. */
export default async function MkLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="frame">
      <Rail />
      {can(user, "approvals.view") ? children : (
        <div className="ap" data-tone="white">
          <div className="ap-noaccess" role="alert">
            <h1>ยังไม่มีสิทธิ์ใช้ MK</h1>
            <p className="ap-muted">บัญชี {user.roleNameTh} ยังไม่ได้รับสิทธิ์ดูคำขออนุมัติการตลาด ติดต่อเจ้าของระบบเพื่อขอสิทธิ์</p>
            <Link href="/" className="ap-btn primary block">กลับหน้าหลัก</Link>
          </div>
        </div>
      )}
    </div>
  );
}
