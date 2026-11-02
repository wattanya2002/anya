import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-thai-looped/400.css";
import "@fontsource/noto-sans-thai-looped/500.css";
import "@fontsource/noto-sans-thai-looped/600.css";
import "@fontsource/noto-sans-thai-looped/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wonder Courts — ระบบจัดการ",
  description: "ระบบหลังบ้าน Wonder Courts: การตลาด สต็อก และรายงานผู้บริหาร",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef3f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
