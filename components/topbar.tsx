import Link from "next/link";
import { Bell, ChevronDown, CircleHelp, KeyRound, LogOut, Search, SlidersHorizontal } from "lucide-react";
import { BrandMark } from "./icons";
import { signOut, markNotificationsRead } from "@/app/actions";
import type { CurrentUser } from "@/lib/auth";

export type TopNotification = { id: string; title: string; body: string | null; href: string | null; read: boolean };

function initials(name: string) {
  const clean = name.replace(/^คุณ/, "").trim();
  return clean.slice(0, 1).toUpperCase() || "W";
}

export function Topbar({ user, notifications, q }: { user: CurrentUser; notifications: TopNotification[]; q?: string }) {
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Wonder Courts หน้าหลัก">
        <BrandMark className="brand-mark" />
        <span className="brand-name">Wonder<br />Courts</span>
      </Link>
      <span className="topbar-divider" aria-hidden="true" />
      <form className="search" role="search" action="/search">
        <Search className="search-icon" size={22} strokeWidth={1.8} aria-hidden="true" />
        <label htmlFor="global-search" className="sr-only">ค้นหา</label>
        <input id="global-search" name="q" type="search" defaultValue={q} placeholder="ค้นหาเมนู ลูกค้า การจอง หรือแคมเปญ..." autoComplete="off" enterKeyHint="search" maxLength={100} />
        <button type="submit" className="search-filter" aria-label="ค้นหา">
          <SlidersHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </form>
      {user.orgIsDemo && <span className="demo-badge" title="ข้อมูลตัวอย่างสำหรับตรวจแบบเท่านั้น"><span className="demo-long">ข้อมูลตัวอย่าง </span>(Demo)</span>}
      <div className="top-actions">
        <details className="menu">
          <summary className="icon-circle" aria-label={unread ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}>
            <Bell aria-hidden="true" />
            {unread > 0 && <span className="dot" aria-hidden="true" />}
          </summary>
          <div className="menu-panel">
            <h3>การแจ้งเตือน</h3>
            {notifications.length === 0 ? (
              <p className="menu-note">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              <>
                {notifications.map((n) => (
                  <Link key={n.id} href={n.href ?? "/"} className="menu-item">
                    <span><b style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</b>{n.body ? <><br /><small>{n.body}</small></> : null}</span>
                  </Link>
                ))}
                {unread > 0 && (
                  <form action={markNotificationsRead}>
                    <button className="menu-item" type="submit">ทำเครื่องหมายว่าอ่านแล้วทั้งหมด</button>
                  </form>
                )}
              </>
            )}
          </div>
        </details>
        <details className="menu help-menu">
          <summary className="icon-circle" aria-label="ความช่วยเหลือ">
            <CircleHelp aria-hidden="true" />
          </summary>
          <div className="menu-panel">
            <h3>ความช่วยเหลือ</h3>
            <p className="menu-note">ตัวเลขบนหน้าหลักคำนวณจากข้อมูลที่บันทึกหรือนำเข้าในระบบนี้เท่านั้น ระบบยังไม่ได้เชื่อมกับเว็บไซต์จองสนามหรือ LINE OA โดยตรง</p>
          </div>
        </details>
        <details className="menu">
          <summary className="profile" aria-label={`บัญชีผู้ใช้ ${user.displayName}`}>
            <span className="avatar" aria-hidden="true">{initials(user.displayName)}</span>
            <span className="profile-text">
              <span className="profile-name" style={{ display: "block" }}>{user.displayName}</span>
              <span className="profile-role" style={{ display: "block" }}>{user.roleNameTh}</span>
            </span>
            <ChevronDown className="chev" size={20} strokeWidth={1.8} aria-hidden="true" />
          </summary>
          <div className="menu-panel">
            <p className="menu-note">{user.email}<br />{user.orgName}</p>
            <Link href="/account/password" className="menu-item"><KeyRound size={18} aria-hidden="true" /> เปลี่ยนรหัสผ่าน</Link>
            <form action={signOut}>
              <button className="menu-item" type="submit"><LogOut size={18} aria-hidden="true" /> ออกจากระบบ</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
