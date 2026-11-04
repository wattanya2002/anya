"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, RAIL, BOTTOM } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { Ellipsis } from "lucide-react";

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/calendar") return pathname === href;
  return pathname.startsWith(href);
}

export function Rail() {
  const pathname = usePathname();
  return (
    <nav className="rail" aria-label="เมนูหลัก">
      {RAIL.map((k) => {
        const item = NAV[k];
        const active = isActive(pathname, item.href);
        return (
          <Link key={k} href={item.href} className="rail-btn" aria-current={active ? "page" : undefined} aria-label={item.label} title={item.label}>
            <NavIcon k={k} />
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const moreKeys = (["dashboard", "content", "promotion", "customers", "courts", "reports", "settings"] as const);
  const moreActive = moreKeys.some((k) => isActive(pathname, NAV[k].href));
  return (
    <nav className="bottom-nav" aria-label="เมนูหลัก">
      {BOTTOM.map((k) => {
        const item = NAV[k];
        const active = isActive(pathname, item.href);
        return (
          <Link key={k} href={item.href} aria-current={active ? "page" : undefined}>
            <NavIcon k={k} />
            <span>{k === "home" ? "หน้าหลัก" : item.label}</span>
          </Link>
        );
      })}
      <details className="menu">
        <summary aria-current={moreActive ? "page" : undefined}>
          <Ellipsis aria-hidden="true" />
          <span>เพิ่มเติม</span>
        </summary>
        <div className="menu-panel" role="menu">
          {moreKeys.map((k) => (
            <Link key={k} href={NAV[k].href} className="menu-item" role="menuitem">
              <NavIcon k={k} className="" />
              <span>{NAV[k].label} · {NAV[k].sub}</span>
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
