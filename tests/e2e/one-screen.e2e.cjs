// One-screen layout check (review round 1): usage E=<email> P=<password> node tests/e2e/one-screen.e2e.cjs (server on :3100)
// Checks: no page scroll (x or y) on PC, iPad and iPhone sizes; each visible card fits the screen (content scrolls inside).
// iPhone: card tabs ("แท็บสลับการ์ด") — every tab is clicked and must show exactly its own card(s) above the bottom nav.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const base = "http://localhost:3100";
  const ctx0 = await b.newContext(); const p0 = await ctx0.newPage();
  await p0.goto(base + "/sign-in"); await p0.fill("#email", process.env.E); await p0.fill("#password", process.env.P);
  await Promise.all([p0.waitForURL(base + "/"), p0.click("button[type=submit]")]);
  const state = await ctx0.storageState();
  const sizes = [[1920,1080],[1448,1086],[1440,900],[1366,768],[1280,800],[1180,820],[1024,768],[1024,1366],[820,1180],[768,1024],[430,932],[393,852],[390,844],[375,667]];
  for (const path of ["/", "/inventory", "/inventory/products", "/inventory/products?new=1", "/inventory/movements", "/inventory/suppliers", "/inventory/import", "/inventory/report", "/calendar", "/calendar?view=week", "/calendar?view=day", "/calendar?view=agenda", "/calendar?new=1", "/calendar/content", "/calendar?date=2026-12-07&holiday=2026-12-07:0", "/modules/marketing", "/search?q=x", "/account/password"]) {
    for (const [w,h] of sizes) {
      const c = await b.newContext({ viewport: { width: w, height: h }, storageState: state, deviceScaleFactor: path === "/" ? (w < 768 ? 2 : 1) : 1 });
      const p = await c.newPage(); await p.goto(base + path, { waitUntil: "networkidle" });
      const r = await p.evaluate(() => {
        const d = document.documentElement;
        const vis = (e) => e.getClientRects().length > 0;
        const nav = document.querySelector(".bottom-nav"); const limit = nav && vis(nav) ? nav.getBoundingClientRect().top : innerHeight;
        const cards = [...document.querySelectorAll(".dash .card, .page, .inv-body > .card, .m-pane")].filter(vis);
        const outside = cards.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > limit + 1 || r.right > innerWidth + 1; }).length;
        const tiny = [...document.querySelectorAll(".dash .card, .inv-body > .card")].filter(vis).filter(c => c.getBoundingClientRect().height < 110).length;
        const tabs = document.querySelectorAll(".mtab-bar [role=tab]").length;
        return { sx: d.scrollWidth - d.clientWidth, sy: d.scrollHeight - d.clientHeight, outside, tiny, tabs };
      });
      let ok = r.sx <= 0 && r.sy <= 0 && r.outside === 0 && r.tiny === 0;
      if (w < 768 && r.tabs) {
        for (let i = 0; i < r.tabs; i++) {
          await p.locator(".mtab-bar [role=tab]").nth(i).click();
          const t = await p.evaluate(() => {
            const vis = (e) => e.getClientRects().length > 0;
            const sel = document.querySelector(".mtab-bar [aria-selected=true]");
            const id = sel.id.split("-").slice(2).join("-");
            const shown = [...document.querySelectorAll("[data-tab]")].filter(vis);
            const wrong = shown.filter((e) => !e.dataset.tab.split(" ").includes(id)).length;
            const lim = document.querySelector(".bottom-nav").getBoundingClientRect().top;
            const out = shown.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > lim + 1 || r.right > innerWidth + 1 || r.height < 110; }).length;
            const d = document.documentElement;
            return { tab: sel.textContent, shown: shown.length, wrong, out, sy: d.scrollHeight - d.clientHeight };
          });
          const tOk = t.shown > 0 && t.wrong === 0 && t.out === 0 && t.sy <= 0;
          if (!tOk) ok = false;
          console.log(`  ${tOk ? "pass" : "FAIL"} tab ${JSON.stringify(t)}`);
          if (path === "/" || path.startsWith("/inventory")) await p.screenshot({ path: `/tmp/ph-${path.replace(/[^a-z]/g, "_")}-${w}-${i}.png` });
        }
      }
      console.log(`${ok ? "PASS" : "FAIL"} ${path} ${w}x${h}`, JSON.stringify(r));
      if (path === "/") await p.screenshot({ path: `/tmp/r1-${w}x${h}.png` });
      await c.close();
    }
  }
  await b.close();
})();
