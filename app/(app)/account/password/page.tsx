import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  await requireUser();
  return (
    <section className="card page" aria-labelledby="pw-title" style={{ maxWidth: 520 }}>
      <h1 id="pw-title">เปลี่ยนรหัสผ่าน</h1>
      <p>รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นที่ล็อกอินอยู่จะถูกออกจากระบบ</p>
      <PasswordForm />
    </section>
  );
}
