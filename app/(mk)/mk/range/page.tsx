import { bangkokToday } from "@/lib/dates";
import { mkViewer } from "@/lib/mk";
import { parseKind, parseRange, parseTab } from "@/lib/mk-core";
import { RangePicker } from "@/components/mk/range-picker";

export const metadata = { title: "กรองตามช่วงวันที่ · MK" };

export default async function RangePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await mkViewer();
  const tab = parseTab(sp.tab);
  const kind = parseKind(sp.type);
  const keep: Record<string, string> = {};
  if (tab !== "pending") keep.tab = tab;
  if (kind) keep.type = kind;
  return (
    <div className="ap" data-tone="gray">
      <RangePicker today={bangkokToday()} initial={parseRange(sp.from, sp.to)} keep={keep} />
    </div>
  );
}
