import {
  House, ChartNoAxesColumnIncreasing, Megaphone, Image as ImageIcon, Tag, Users, Package, FileText, Settings, Share2, Box,
} from "lucide-react";
import type { NavKey } from "@/lib/nav";
import { CourtBall } from "./icons";

export function NavIcon({ k, className }: { k: NavKey; className?: string }) {
  const p = { className, "aria-hidden": true as const, strokeWidth: 1.8 };
  switch (k) {
    case "home": return <House {...p} />;
    case "dashboard": return <ChartNoAxesColumnIncreasing {...p} />;
    case "marketing": return <Megaphone {...p} />;
    case "content": return <ImageIcon {...p} />;
    case "promotion": return <Tag {...p} />;
    case "customers": return <Users {...p} />;
    case "courts": return <CourtBall className={className} />;
    case "inventory": return <Box {...p} />;
    case "reports": return <FileText {...p} />;
    case "settings": return <Settings {...p} />;
    case "social": return <Share2 {...p} />;
    default: return <Package {...p} />;
  }
}
