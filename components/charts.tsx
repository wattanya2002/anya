const COLOR: Record<string, string> = {
  pink: "var(--wc-donut-pink)", blue: "var(--wc-donut-blue)", purple: "var(--wc-donut-purple)",
  green: "#cdeed6", amber: "#f8dcc0",
};
export const sliceColor = (c: string) => COLOR[c] ?? COLOR.pink;

export function Donut({ slices, total }: { slices: { color: string; count: number; name: string }[]; total: number }) {
  const r = 64, stroke = 30, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut" role="img" aria-label={`การจองทั้งหมด ${total} รายการ แยกตามประเภทสนาม`}>
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f3f7" strokeWidth={stroke} />
        {total > 0 &&
          slices.filter((s) => s.count > 0).map((s) => {
            const len = (s.count / total) * c;
            const el = (
              <circle key={s.name} cx="80" cy="80" r={r} fill="none" stroke={sliceColor(s.color)} strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        <circle cx="80" cy="80" r={r - stroke / 2} fill="#fff" />
      </svg>
      <div className="donut-center"><b>{total.toLocaleString("en-US")}</b><span>การจอง</span></div>
    </div>
  );
}

/** Thin pink line + soft fill, smoothed with a Catmull-Rom → Bézier conversion. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 400, H = 92, pad = 4;
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - 2 * pad), H - pad - ((v - min) / span) * (H - 2 * pad - 6)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const fill = `${d} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6a3c2" stopOpacity=".42" />
          <stop offset="1" stopColor="#fbe3ed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="#f27aa6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}
