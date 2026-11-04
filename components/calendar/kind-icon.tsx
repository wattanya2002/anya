import { ClipboardList, FileText, Megaphone, Package, PhoneCall, SquareCheck, Trophy, Users, Video } from "lucide-react";
import type { CalKind } from "@/lib/calendar-core";

/** Line icon per calendar item type (Day cards and Month chips, RCM v1.1 §3.2 / §4.4). */
export function KindIcon({ kind, className }: { kind: CalKind; className?: string }) {
  const p = { className, "aria-hidden": true as const, strokeWidth: 1.8 };
  switch (kind) {
    case "promotion": case "campaign": return <Megaphone {...p} />;
    case "content": return <Video {...p} />;
    case "appointment": return <Users {...p} />;
    case "stock": return <Package {...p} />;
    case "court_event": return <Trophy {...p} />;
    case "task": return <SquareCheck {...p} />;
    case "report": return <FileText {...p} />;
    case "followup": return <PhoneCall {...p} />;
    case "general": return <ClipboardList {...p} />;
  }
}
