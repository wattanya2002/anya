// LOCAL VISUAL-QA ONLY. Creates a separate organization flagged is_demo=true with a labelled
// demo dataset so the Home layout can be compared with the master image. Refuses to run
// against Neon / any host other than localhost.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("seed-demo only runs against a localhost database");
  process.exit(1);
}
const scrypt = promisify(scryptCb);
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr, w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { if ((r -= w[i]) < 0) return arr[i]; } return arr.at(-1); };
const iso = (d) => d.toISOString().slice(0, 10);
const bkkToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const dayOffset = (n) => { const d = new Date(`${bkkToday}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("begin");
await c.query("delete from organizations where is_demo = true");
await c.query("delete from users where email = 'demo@wondercourts.local'");
const org = (await c.query("insert into organizations (name, is_demo) values ('Wonder Courts (Demo)', true) returning id")).rows[0].id;
const salt = randomBytes(16);
const key = await scrypt("demo-password-local", salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const user = (await c.query(
  "insert into users (email, display_name, password_hash) values ('demo@wondercourts.local', 'คุณอรทัย', $1) returning id",
  [`scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`],
)).rows[0].id;
await c.query("insert into memberships (org_id, user_id, role_key) values ($1, $2, 'owner')", [org, user]);

const types = [];
for (const [k, name, color, sort] of [["indoor", "สนามในร่ม", "pink", 1], ["outdoor", "สนามกลางแจ้ง", "blue", 2], ["premium", "สนามพรีเมียม", "purple", 3]]) {
  types.push((await c.query("insert into court_types (org_id, key, name_th, color, sort_order) values ($1,$2,$3,$4,$5) returning id", [org, k, name, color, sort])).rows[0].id);
}
const job = (await c.query(
  "insert into import_jobs (org_id, kind, source, status, file_name, created_by, finished_at) values ($1,'bookings','import','completed','demo-bookings.csv',$2, now() - interval '25 minutes') returning id",
  [org, user],
)).rows[0].id;
const promo = (await c.query(
  "insert into promotions (org_id, name, code, status, discount_bps, starts_at, ends_at, cover_image_path, created_by) values ($1, 'โปรสมาชิกใหม่ รับส่วนลด 10%', 'NEW10', 'live', 1000, now() - interval '40 days', now() + interval '30 days', '/brand/promo-tennis.png', $2) returning id",
  [org, user],
)).rows[0].id;

// customers: 300 long-standing + new ones per window
const bookings = [];
let ext = 0;
const add = (date, cust, promoted, channel) => {
  const type = pick([0, 1, 2], [58, 32, 10]);
  const hours = pick([1, 1.5, 2], [5, 2, 3]);
  const rate = [550, 450, 900][type];
  bookings.push([`D-${++ext}`, date, hours, types[type], Math.round(hours * rate * (promoted ? 0.9 : 1) * 100), cust, promoted ? promo : null, channel]);
};
const channels = ["facebook", "instagram", "tiktok", "line", "site", null];
for (let i = 0; i < 260; i++) add(dayOffset(-60 - Math.floor(rnd() * 60)), `C${i}`, false, null);         // history
for (let i = 0; i < 380; i++) add(dayOffset(-30 - Math.floor(rnd() * 30)), `C${i < 103 ? 1000 + i : Math.floor(rnd() * 200)}`, false, pick(channels, [3, 2, 1, 2, 3, 6]));
for (let i = 0; i < 428; i++) {
  const isNew = i < 128;
  add(dayOffset(-Math.floor(rnd() * 30)), isNew ? `C${2000 + i}` : `C${Math.floor(rnd() * 240)}`, i < 146, pick(channels, [3, 2, 1, 2, 3, 6]));
}
for (const b of bookings) {
  await c.query(
    "insert into bookings_imported (org_id, import_job_id, external_id, play_date, hours, court_type_id, amount_satang, status, customer_ref, promotion_id, source_channel) values ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9,$10)",
    [org, job, ...b],
  );
}
for (let i = 0; i < 40; i++) {
  await c.query("insert into promotion_feedback (org_id, promotion_id, rating, source, received_on) values ($1,$2,$3,'manual',$4)", [org, promo, i < 32 ? 5 : 4, dayOffset(-Math.floor(rnd() * 28))]);
}
for (let d = -59; d <= 0; d++) {
  const cur = d > -30;
  const reach = Math.round((cur ? 2750 : 2160) * (0.8 + 0.4 * rnd()));
  const k = (d + 29) / 29; // 0..1 across the current window
  const wave = cur ? 0.35 + 0.9 * k * k + Math.sin(k * 9) * 0.08 : 0.6 + Math.sin(d / 4) * 0.1;
  const clicks = Math.round((cur ? 175 : 150) * (0.75 + wave));
  await c.query("insert into social_metric_snapshots (org_id, platform, metric, snapshot_date, value, source, entered_by, updated_at) values ($1,'facebook','reach',$2,$3,'manual',$4, now() - interval '1 day')", [org, dayOffset(d), reach, user]);
  await c.query("insert into social_metric_snapshots (org_id, platform, metric, snapshot_date, value, source, entered_by, updated_at) values ($1,'facebook','link_clicks',$2,$3,'manual',$4, now() - interval '1 day')", [org, dayOffset(d), clicks, user]);
}
const tasks = [["อนุมัติคำขอจองคอร์ท (3 รายการ)", "10:00", true], ["อัปเดตคอนเทนต์กิจกรรมรายสัปดาห์", "11:30", false], ["ตั้งค่าโปรโมชั่นประจำเดือน", "13:00", false], ["ตอบข้อความลูกค้าใน Social", null, false], ["ตรวจสอบสต็อกอุปกรณ์", "16:30", false]];
for (const [i, [title, time, done]] of tasks.entries()) {
  await c.query(
    "insert into tasks (org_id, title, due_date, due_time, status, created_by, completed_by, completed_at, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8, now() - make_interval(mins => 60 - $9::int))",
    [org, title, bkkToday, time, done ? "done" : "open", user, done ? user : null, done ? new Date() : null, i],
  );
}
// ---------------- inventory demo (local only)
const locs = [];
for (const [name, kind, sort] of [["คลังสินค้า", "warehouse", 1], ["ตู้ขายน้ำ", "cabinet", 2]]) {
  locs.push((await c.query("insert into inventory_locations (org_id, name, kind, sort_order) values ($1,$2,$3,$4) returning id", [org, name, kind, sort])).rows[0].id);
}
const catIds = {};
for (const [i, n] of ["เครื่องดื่ม", "อุปกรณ์เทนนิส", "ของใช้ในสนาม"].entries()) catIds[n] = (await c.query("insert into product_categories (org_id, name, sort_order) values ($1,$2,$3) returning id", [org, n, i])).rows[0].id;
const brandIds = {};
for (const n of ["น้ำใสดี", "สปอร์ตพลัส", "เกลือแร่เย็น", "เทนนิสโปร", "กริปเฟรช", "คลีนคอร์ท"]) brandIds[n] = (await c.query("insert into brands (org_id, name) values ($1,$2) returning id", [org, n])).rows[0].id;
const sup1 = (await c.query("insert into suppliers (org_id, name, contact_name, phone, line_url, lead_time_days, note) values ($1,'ร้านส่งน้ำ ตัวอย่าง','คุณเอ','0812345678','https://line.me/R/ti/p/~demo-water',2,'ส่งทุกวันอังคาร/ศุกร์ ขั้นต่ำ 10 แพ็ก') returning id", [org])).rows[0].id;
const sup2 = (await c.query("insert into suppliers (org_id, name, contact_name, phone, line_url, lead_time_days) values ($1,'ร้านอุปกรณ์กีฬา ตัวอย่าง','คุณบี','0898765432','https://line.me/R/ti/p/%40demo-sport',5) returning id", [org])).rows[0].id;
const items = [
  ["WATER-600", "น้ำดื่ม 600 มล.", "เครื่องดื่ม", "น้ำใสดี", sup1, "ขวด", 12, 550, 1000, 48, 96, [120, 18]],
  ["WATER-1500", "น้ำดื่ม 1.5 ลิตร", "เครื่องดื่ม", "น้ำใสดี", sup1, "ขวด", 6, 1200, 2000, 24, 48, [30, 6]],
  ["ELEC-500", "เครื่องดื่มเกลือแร่ 500 มล.", "เครื่องดื่ม", "เกลือแร่เย็น", sup1, "ขวด", 24, 1400, 2500, 24, 48, [12, 4]],
  ["SPORT-330", "เครื่องดื่มชูกำลัง 330 มล.", "เครื่องดื่ม", "สปอร์ตพลัส", sup1, "กระป๋อง", 24, 1500, 2500, 12, 24, [0, 0]],
  ["BALL-3", "ลูกเทนนิส (กระป๋อง 3 ลูก)", "อุปกรณ์เทนนิส", "เทนนิสโปร", sup2, "กระป๋อง", 1, 12000, 18000, 5, 12, [8, 0]],
  ["GRIP-01", "กริปพันด้าม", "อุปกรณ์เทนนิส", "กริปเฟรช", sup2, "ชิ้น", 1, 4500, 8000, 10, 20, [6, 0]],
  ["RACKET-RENT", "ไม้เทนนิสให้เช่า", "อุปกรณ์เทนนิส", "เทนนิสโปร", sup2, "อัน", 1, 150000, null, 2, 2, [10, 0]],
  ["TOWEL-S", "ผ้าขนหนูเล็ก", "ของใช้ในสนาม", "คลีนคอร์ท", null, "ผืน", 1, 3500, 6000, 10, 20, [25, 0]],
  ["CLEAN-1L", "น้ำยาทำความสะอาดพื้น 1 ลิตร", "ของใช้ในสนาม", "คลีนคอร์ท", null, "ขวด", 1, 8900, null, 2, 4, [1, 0]],
];
for (const [sku, name, cat, brand, sup, unit, pack, cost, price, rp, rq, qtys] of items) {
  const pid = (await c.query(
    "insert into products (org_id, sku, name, category_id, brand_id, supplier_id, unit, pack_size, cost_satang, price_satang, reorder_point, reorder_qty, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id",
    [org, sku, name, catIds[cat], brandIds[brand], sup, unit, pack, cost, price, rp, rq, user])).rows[0].id;
  for (const [i, q] of qtys.entries()) {
    if (q <= 0) continue;
    await c.query("insert into stock_balances (org_id, product_id, location_id, qty) values ($1,$2,$3,$4)", [org, pid, locs[i], q]);
    await c.query("insert into stock_movements (org_id, product_id, location_id, type, qty_delta, balance_after, unit_cost_satang, note, actor_user_id, created_at) values ($1,$2,$3,'OPENING',$4,$4,$5,'ยอดตั้งต้น (ตัวอย่าง)',$6, now() - interval '3 days')", [org, pid, locs[i], q, cost, user]);
  }
}
await c.query("insert into notifications (org_id, user_id, title, body) values ($1,$2,'มีคำขออนุมัติใหม่','โปรโมชั่นประจำเดือนรออนุมัติ')", [org, user]);
await c.query("commit");
await c.end();
console.log(`demo org seeded: ${bookings.length} bookings (login demo@wondercourts.local / demo-password-local)`);
