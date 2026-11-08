"use client";
import Link from "next/link";
import { RotateCcw, WifiOff } from "lucide-react";

/** Load failure (canvas 08 · โหลดล้มเหลว): nothing typed elsewhere is lost; retry re-renders the screen. */
export default function MkError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="ap" data-tone="white">
      <div className="ap-page"><div className="ap-col" style={{ justifyContent: "center" }}>
        <div className="ap-empty" role="alert">
          <span className="ap-empty-ic red"><WifiOff aria-hidden="true" /></span>
          <b>โหลดไม่สำเร็จ</b>
          <p>ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง ข้อมูลเดิมยังอยู่</p>
          <button type="button" className="ap-btn primary" onClick={reset}><RotateCcw aria-hidden="true" />ลองอีกครั้ง</button>
          <Link href="/mk" className="ap-btn ghost" style={{ marginTop: 6 }}>กลับหน้ารวมคำขอ</Link>
        </div>
      </div></div>
    </div>
  );
}
