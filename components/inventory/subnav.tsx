"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "ภาพรวม" },
  { href: "/inventory/products", label: "สินค้า" },
  { href: "/inventory/movements", label: "รับเข้า/เบิก" },
  { href: "/inventory/suppliers", label: "ซัพพลายเออร์" },
  { href: "/inventory/import", label: "นำเข้าไฟล์" },
  { href: "/inventory/report", label: "สรุปส่งหัวหน้า" },
];

export function InventorySubnav() {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label="เมนู Inventory">
      {TABS.map((t) => {
        const active = t.href === "/inventory" ? path === "/inventory" : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
