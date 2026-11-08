import Link from "next/link";
import { Clock, Users } from "lucide-react";
import { bangkokToday } from "@/lib/dates";
import { listPeople, unreadCount, type PersonCard as PersonRow, mkViewer } from "@/lib/mk";
import { baht, dueLabel, refLabel } from "@/lib/mk-core";
import { BellLink, Empty, Head, MkNav, Panel, Screen } from "@/components/mk/ui";
import { PersonCard } from "@/components/mk/person-card";

export const metadata = { title: "อินฟลูเอนเซอร์ · MK" };

export default async function InfluencersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab === "approved" ? "approved" : "pending";
  const user = await mkViewer();
  const today = bangkokToday();
  const [{ people, counts }, unread] = await Promise.all([listPeople(user, tab), unreadCount(user)]);
  // Group by request so the reviewer sees each brief's total and deadline.
  const groups = new Map<string, PersonRow[]>();
  for (const p of people) groups.set(p.requestId, [...(groups.get(p.requestId) ?? []), p]);
  const totalFee = people.reduce((s, p) => s + (p.feeSatang ?? 0), 0);
  return (
    <Screen>
      <Head title="อินฟลูเอนเซอร์" right={<BellLink unread={unread} />}
        sub={<span>{tab === "pending" ? `รอตัดสินใจ ${counts.pending} คน${totalFee ? ` · ค่าจ้างรวม ${baht(totalFee)}` : ""}` : `อนุมัติแล้ว ${counts.approved} คน`}</span>} />
      <Panel soft>
        <nav className="ap-seg" aria-label="สถานะอินฟลูเอนเซอร์">
          <Link href="/mk/influencers" aria-current={tab === "pending" ? "page" : undefined}><span>รอตัดสินใจ</span><b>{counts.pending}</b></Link>
          <Link href="/mk/influencers?tab=approved" aria-current={tab === "approved" ? "page" : undefined}><span>อนุมัติแล้ว</span></Link>
        </nav>
        {people.length === 0 ? (
          <Empty icon={<Users aria-hidden="true" />} title={tab === "pending" ? "ไม่มีอินฟลูเอนเซอร์รอตัดสินใจ" : "ยังไม่มีอินฟลูเอนเซอร์ที่อนุมัติ"}>
            {tab === "pending" ? "เมื่อทีมส่งคำขอคัดเลือกอินฟลูเอนเซอร์ รายชื่อจะแสดงที่นี่" : undefined}
          </Empty>
        ) : [...groups.values()].map((g) => {
          const f = g[0];
          const fee = g.reduce((s, p) => s + (p.feeSatang ?? 0), 0);
          const due = dueLabel(f.decideBy, today);
          return (
            <section key={f.requestId} className="ap-group" aria-label={`คำขอ ${refLabel(f.refNo)}`}>
              <div className="ap-group-head">
                <Link href={`/mk/requests/${f.requestId}`}>{refLabel(f.refNo)} · {f.requestTitle}</Link>
              </div>
              <div className="ap-sum" style={{ marginTop: 6 }}>
                <span>{fee ? <>ค่าจ้างรวม <b>{baht(fee)}</b> · </> : null}{g.length} คน</span>
                {tab === "pending" && <span className="warn" style={due.urgent ? { color: "var(--ap-red)" } : undefined}><Clock aria-hidden="true" strokeWidth={2} />{due.text}</span>}
              </div>
              <ul className="ap-people">{g.map((p) => <PersonCard key={p.id} p={p} href={`/mk/requests/${p.requestId}/people/${p.id}`} />)}</ul>
            </section>
          );
        })}
      </Panel>
      <MkNav active="inf" unread={unread} />
    </Screen>
  );
}
