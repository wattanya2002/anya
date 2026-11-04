/** Navigation map (RCM §3). `built: false` routes render an honest "not yet available" page. */
export type NavKey =
  | "home" | "calendar" | "dashboard" | "marketing" | "content" | "promotion" | "customers"
  | "courts" | "inventory" | "reports" | "settings" | "social";

export type NavItem = { key: NavKey; href: string; label: string; sub: string; phase: string; screens: string };

export const NAV: Record<NavKey, NavItem> = {
  home:       { key: "home",       href: "/",                    label: "หน้าหลัก",  sub: "ภาพรวมธุรกิจ",       phase: "P0", screens: "S01" },
  calendar:   { key: "calendar",   href: "/calendar",            label: "ปฏิทิน",    sub: "ปฏิทินกลาง ทุกโมดูล",   phase: "P0", screens: "Master Calendar (RCM Addition)" },
  dashboard:  { key: "dashboard",  href: "/modules/dashboard",   label: "Dashboard", sub: "ภาพรวมธุรกิจ",       phase: "P0", screens: "S25 KPI Analytics" },
  marketing:  { key: "marketing",  href: "/modules/marketing",   label: "Marketing", sub: "แคมเปญ & โฆษณา",     phase: "P0", screens: "S02–S06" },
  content:    { key: "content",    href: "/calendar/content",     label: "Content",   sub: "Content Calendar",     phase: "P0", screens: "S10–S13" },
  promotion:  { key: "promotion",  href: "/modules/promotion",   label: "Promotion", sub: "โปรโมชั่น & ดีล",     phase: "P0", screens: "S07–S09" },
  customers:  { key: "customers",  href: "/modules/customers",   label: "CRM",       sub: "ลูกค้า & สมาชิก",     phase: "P1", screens: "S14–S16" },
  courts:     { key: "courts",     href: "/modules/courts",      label: "Courts",    sub: "ประเภทสนาม & นำเข้าการจอง", phase: "P0", screens: "S28 Data Import (bookings)" },
  inventory:  { key: "inventory",  href: "/inventory",   label: "Inventory", sub: "สต็อก & อุปกรณ์",     phase: "P0", screens: "S17–S24" },
  reports:    { key: "reports",    href: "/modules/reports",     label: "Reports",   sub: "รายงาน & วิเคราะห์",  phase: "P0/P1", screens: "S25–S26" },
  settings:   { key: "settings",   href: "/modules/settings",    label: "Settings",  sub: "ตั้งค่า สิทธิ์ & Audit", phase: "P0", screens: "S27–S30" },
  social:     { key: "social",     href: "/modules/social",      label: "Social KPI", sub: "ผลลัพธ์โซเชียล",     phase: "P0", screens: "S03–S04" },
};

export const RAIL: NavKey[] = ["home", "calendar", "dashboard", "marketing", "content", "promotion", "customers", "courts", "inventory", "reports", "settings"];
export const BOTTOM: NavKey[] = ["home", "calendar", "marketing", "inventory"];
