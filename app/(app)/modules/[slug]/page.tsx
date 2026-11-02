import Link from "next/link";
import { notFound } from "next/navigation";
import { NAV, type NavKey } from "@/lib/nav";
import { NavIcon } from "@/components/nav-icon";
import { requireUser } from "@/lib/auth";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const item = NAV[slug as NavKey];
  if (!item || slug === "home") notFound();
  return (
    <section className="card page" aria-labelledby="module-title">
      <span className="badge-icon tone-pink" aria-hidden="true"><NavIcon k={item.key} /></span>
      <h1 id="module-title" style={{ marginTop: 14 }}>{item.label} · {item.sub}</h1>
      <p>โมดูลนี้ยังไม่เปิดใช้งาน — อยู่ในแผนพัฒนา {item.phase} ({item.screens}) ตามเอกสาร RCM</p>
      <p>ทีมจะเริ่มพัฒนาหลังหน้าหลัก (Home) ผ่านการตรวจแบบเทียบภาพ Master ทั้ง PC, iPad และ iPhone ระหว่างนี้หน้านี้ไม่แสดงข้อมูลจำลอง</p>
      <p><Link href="/" className="link-btn">กลับหน้าหลัก</Link></p>
    </section>
  );
}
