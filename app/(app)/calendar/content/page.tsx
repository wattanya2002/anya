import { requireUser, can } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/screen";

export const dynamic = "force-dynamic";

/** S10 Content Calendar = the master calendar filtered to content items (RCM Addition). */
export default async function ContentCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "calendar.view")) {
    return (
      <section className="card page" aria-labelledby="cc-denied">
        <h1 id="cc-denied">ไม่มีสิทธิ์เข้าถึง Content Calendar</h1>
        <p>บทบาท “{user.roleNameTh}” ไม่มีสิทธิ์ดูปฏิทิน กรุณาติดต่อผู้ดูแลระบบ</p>
      </section>
    );
  }
  return <CalendarScreen user={user} searchParams={await searchParams} base="/calendar/content"
    preset={{ kind: "content", title: "Content Calendar", sub: "มุมมองย่อยของปฏิทินกลาง" }} />;
}
