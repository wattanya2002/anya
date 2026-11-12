import type { Viewport } from "next";
import "@/components/kol/public-form.css";

export const dynamic = "force-dynamic";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fbfaf5" };

/** Public pages (no sign-in): KOL application, STEP 2 registration by private link, applicant status. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
