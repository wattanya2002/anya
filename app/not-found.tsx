import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth">
      <section className="card auth-card"><h1>ไม่พบหน้านี้</h1><p>ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกย้ายแล้ว</p><Link className="btn" href="/" style={{ display: "grid", placeItems: "center" }}>กลับหน้าหลัก</Link></section>
    </main>
  );
}
