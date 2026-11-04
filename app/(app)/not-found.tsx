import Link from "next/link";

/** 404 inside the signed-in shell: the layout already provides <main>, so this renders a card only. */
export default function AppNotFound() {
  return (
    <section className="card page" aria-labelledby="nf-title">
      <h1 id="nf-title">ไม่พบหน้านี้</h1>
      <p>ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกย้ายแล้ว</p>
      <Link className="btn-pill primary" href="/">กลับหน้าหลัก</Link>
    </section>
  );
}
