import {
  Baby, Crown, Droplets, Flower, Flower2, Ghost, GraduationCap, HardHat, Heart, Leaf, PartyPopper, Ribbon, ScrollText,
} from "lucide-react";
import type { ThemeKey } from "@/lib/holidays-th";

type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };

/** Chinese lantern (no matching line icon in lucide). */
function Lantern({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 1.5V4" />
      <path d="M9 4h6" />
      <ellipse cx="12" cy="11" rx="9" ry="6" fill="currentColor" fillOpacity="0.14" />
      <path d="M9.6 5.3C8.4 6.9 7.8 8.8 7.8 11s.6 4.1 1.8 5.7" /><path d="M14.4 5.3c1.2 1.6 1.8 3.5 1.8 5.7s-.6 4.1-1.8 5.7" />
      <path d="M9 18h6" />
      <path d="M10.5 18v3.5" /><path d="M12 18v4" /><path d="M13.5 18v3.5" />
    </svg>
  );
}

/** Krathong: a lotus float with a candle on water, under a full moon. */
function Krathong({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="19" cy="4.5" r="2" />
      <path d="M12 6.5v3" /><path d="M12 3.2c.9 1 .9 1.9 0 2.6-.9-.7-.9-1.6 0-2.6z" />
      <path d="M5 15c0-3 2.2-4.8 4-5 .5 1.8.6 3.4.3 5" /><path d="M19 15c0-3-2.2-4.8-4-5-.5 1.8-.6 3.4-.3 5" />
      <path d="M9.4 15c.2-2.6 1.2-4.4 2.6-5.3 1.4.9 2.4 2.7 2.6 5.3" />
      <path d="M4 15h16l-1.6 2.5H5.6z" />
      <path d="M2.5 20.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
    </svg>
  );
}

/** Christmas tree with a star (lucide's pine reads as a bell at 12–14px). */
function XmasTree({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 1.8l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 3.9l2-.3z" />
      <path d="M12 8.5L7 14h3l-4 5h12l-4-5h3z" />
      <path d="M12 19v3" />
    </svg>
  );
}

/** Line icon for a holiday theme; matches the lucide stroke style used across the app. */
export function HolidayIcon({ theme, className }: { theme: ThemeKey; className?: string }) {
  const p = { className, "aria-hidden": true as const, strokeWidth: 1.8 };
  switch (theme) {
    case "newyear": return <PartyPopper {...p} />;
    case "songkran": return <Droplets {...p} />;
    case "buddhist": return <Flower2 {...p} />;
    case "king": case "queen": case "royal": return <Crown {...p} />;
    case "mother": case "father": return <Flower {...p} />;
    case "memorial": return <Ribbon {...p} />;
    case "labour": return <HardHat {...p} />;
    case "constitution": return <ScrollText {...p} />;
    case "cny": return <Lantern className={className} />;
    case "valentine": return <Heart {...p} />;
    case "loykrathong": return <Krathong className={className} />;
    case "halloween": return <Ghost {...p} />;
    case "christmas": return <XmasTree className={className} />;
    case "children": return <Baby {...p} />;
    case "teacher": return <GraduationCap {...p} />;
    case "vegetarian": return <Leaf {...p} />;
  }
}
