/** Loading state shared by the MK screens (canvas 08 · กำลังโหลด). */
export default function Loading() {
  return (
    <div className="ap" aria-busy="true" aria-label="กำลังโหลด">
      <header className="ap-head"><div className="ap-col"><div className="ap-head-row"><span className="ap-brand">Wonder Courts · การตลาด</span></div>
        <div className="ap-skel" style={{ padding: "14px 0 0" }}><i style={{ width: 120, height: 30 }} /></div></div></header>
      <main className="ap-panel"><div className="ap-col">
        <div className="ap-seg" style={{ height: 52 }} />
        {[85, 70, 78, 64].map((w) => (
          <div key={w} className="ap-skel">
            <i style={{ width: 44, height: 44, borderRadius: 14 }} />
            <span style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              <i style={{ width: "30%", height: 10 }} /><i style={{ width: `${w}%`, height: 14, background: "#e4e7ee" }} /><i style={{ width: "45%", height: 10 }} />
            </span>
            <i style={{ width: 72, height: 26, borderRadius: 999 }} />
          </div>
        ))}
        <span className="sr-only">กำลังโหลดรายการ</span>
      </div></main>
    </div>
  );
}
