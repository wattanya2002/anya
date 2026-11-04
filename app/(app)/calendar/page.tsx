import { requireUser, can } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/screen";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "calendar.view")) {
    return (
      <section className="card page" aria-labelledby="cal-denied">
        <h1 id="cal-denied">ไม่มีสิทธิ์เข้าถึงปฏิทินกลาง</h1>
        <p>บทบาท “{user.roleNameTh}” ไม่มีสิทธิ์ดูปฏิทิน กรุณาติดต่อผู้ดูแลระบบ</p>
      </section>
    );
  }
  return <CalendarScreen user={user} searchParams={await searchParams} base="/calendar" />;
}
