import { Box } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { InventorySubnav } from "@/components/inventory/subnav";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!can(user, "inventory.view")) {
    return (
      <section className="card page" aria-labelledby="inv-denied">
        <h1 id="inv-denied">ไม่มีสิทธิ์เข้าถึง Inventory</h1>
        <p>บทบาท “{user.roleNameTh}” ไม่มีสิทธิ์ดูข้อมูลสต็อก กรุณาติดต่อผู้ดูแลระบบ</p>
      </section>
    );
  }
  return (
    <div className="inv">
      <div className="inv-head">
        <h1 className="inv-title"><span className="badge-icon tone-blue" aria-hidden="true"><Box /></span>Inventory · สต็อก &amp; อุปกรณ์</h1>
        <InventorySubnav />
      </div>
      {children}
    </div>
  );
}
