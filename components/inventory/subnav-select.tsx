"use client";
import { usePathname, useRouter } from "next/navigation";
import { INV_TABS } from "./subnav";

/** Phone-only compact navigation for the Inventory sections (saves two rows of pills). */
export function InventorySubnavSelect() {
  const path = usePathname();
  const router = useRouter();
  const current = INV_TABS.find((t) => (t.href === "/inventory" ? path === "/inventory" : path.startsWith(t.href)))?.href ?? "/inventory";
  return (
    <div className="subnav-select">
      <label htmlFor="inv-section" className="sr-only">ส่วนของ Inventory</label>
      <select id="inv-section" value={current} onChange={(e) => router.push(e.target.value)}>
        {INV_TABS.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}
      </select>
    </div>
  );
}
