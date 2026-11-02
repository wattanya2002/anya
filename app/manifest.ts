import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wonder Courts — ระบบจัดการ",
    short_name: "Wonder Courts",
    description: "ระบบหลังบ้าน Wonder Courts: การตลาด สต็อก และรายงานผู้บริหาร",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3f9",
    theme_color: "#eef3f9",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
