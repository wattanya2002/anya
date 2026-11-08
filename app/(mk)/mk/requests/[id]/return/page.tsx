import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth";
import { getRequest, mkViewer } from "@/lib/mk";
import { baht, refLabel } from "@/lib/mk-core";
import { Tile } from "@/components/mk/ui";
import { ReturnForm } from "@/components/mk/decision-forms";

export const metadata = { title: "ส่งกลับแก้ไข · MK" };

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await mkViewer();
  const r = await getRequest(user, id);
  if (!r) notFound();
  if (r.status !== "pending" || !can(user, "approvals.decide")) redirect(`/mk/requests/${id}`);
  const back = `/mk/requests/${id}`;
  return (
    <div className="ap" data-tone="white">
      <Link href={back} className="ap-sheet-veil" aria-label="ยกเลิกและกลับไปที่คำขอ" tabIndex={-1} />
      <section className="ap-sheet" aria-labelledby="sb-title" role="dialog" aria-modal="true">
        <div style={{ padding: "4px 16px 0", flex: "none" }}>
          <div className="ap-col">
            <div className="ap-sheet-head">
              <Link href={back}>ยกเลิก</Link>
              <h1 id="sb-title">ส่งกลับแก้ไข</h1>
              <span className="ph" />
            </div>
            <div className="ap-mini">
              <Tile kind={r.kind} size={40} />
              <span><b>{r.title}</b><small>{[r.amountSatang !== null ? baht(r.amountSatang) : r.discountText, refLabel(r.refNo)].filter(Boolean).join(" · ")}</small></span>
            </div>
          </div>
        </div>
        <ReturnForm requestId={r.id} />
      </section>
    </div>
  );
}
