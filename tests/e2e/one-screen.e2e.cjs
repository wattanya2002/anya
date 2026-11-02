// One-screen layout check (review round 1): usage E=<email> P=<password> node tests/e2e/one-screen.e2e.cjs (server on :3100)
// Checks: no page scroll (x or y) on PC/iPad sizes; each card fits its row (content scrolls inside).
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const base = "http://localhost:3100";
  const ctx0 = await b.newContext(); const p0 = await ctx0.newPage();
  await p0.goto(base + "/sign-in"); await p0.fill("#email", process.env.E); await p0.fill("#password", process.env.P);
  await Promise.all([p0.waitForURL(base + "/"), p0.click("button[type=submit]")]);
  const state = await ctx0.storageState();
  const sizes = [[1920,1080],[1448,1086],[1440,900],[1366,768],[1280,800],[1180,820],[1024,768],[1024,1366],[820,1180],[768,1024],[393,852]];
  for (const path of ["/", "/modules/inventory", "/search?q=x", "/account/password"]) {
    for (const [w,h] of sizes) {
      const c = await b.newContext({ viewport: { width: w, height: h }, storageState: state, deviceScaleFactor: path === "/" ? (w < 768 ? 2 : 1) : 1 });
      const p = await c.newPage(); await p.goto(base + path, { waitUntil: "networkidle" });
      const r = await p.evaluate(() => {
        const d = document.documentElement;
        const cards = [...document.querySelectorAll(".dash .card, .page")];
        const outside = cards.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1; }).length;
        const tiny = [...document.querySelectorAll(".dash .card")].filter(c => c.getBoundingClientRect().height < 110).length;
        return { sx: d.scrollWidth - d.clientWidth, sy: d.scrollHeight - d.clientHeight, outside, tiny };
      });
      const ok = w < 768 ? r.sx <= 0 : (r.sx <= 0 && r.sy <= 0 && r.outside === 0);
      console.log(`${ok ? "PASS" : "FAIL"} ${path} ${w}x${h}`, JSON.stringify(r));
      if (path === "/") await p.screenshot({ path: `/tmp/r1-${w}x${h}.png` });
      await c.close();
    }
  }
  await b.close();
})();
