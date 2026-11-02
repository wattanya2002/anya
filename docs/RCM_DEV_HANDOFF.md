# WONDER COURTS — RCM / Developer Handoff

**RCM ในเอกสารนี้ = Requirements & Context Master** (เอกสารบริบทและข้อกำหนดหลักสำหรับส่งต่อทีมพัฒนา พร้อม Requirement Coverage Matrix)  
**Version:** 1.0 · **วันที่:** 2 พฤศจิกายน 2026 · **สถานะ:** SPEC / ยังไม่ใช่ระบบ Production  
**Project:** Wonder Courts Management System  
**เจ้าของข้อกำหนด:** ทีมผู้ใช้งาน Wonder Courts · **ผู้รับ:** Developer / Product Designer / QA

> **คำสั่งสำคัญที่สุด: ใช้ไฟล์ `assets/MASTER_UI_REFERENCE.png` เป็น Visual Source of Truth.** ผู้ใช้งานยืนยันหลายครั้งว่าต้องการภาพนี้ *โดยตรง* ทั้งความขาวสว่าง แสงฟ้าฟุ้ง ความโปร่ง การ์ด เงา ขอบมน ความนุ่ม และระยะห่าง ไม่ใช่แค่ธีมชมพู–ฟ้าใกล้เคียง ภาพชุด 90 หน้าที่เคยทำก่อนหน้ามีดีไซน์คลาดเคลื่อน: **ห้ามใช้เป็น Visual Master** และห้ามเปลี่ยนสไตล์เอง

---

## 0. คำสั่งให้ Dev อ่านก่อนเริ่มงาน

1. **ตรวจ Repo / Vercel Project / Production URL เดิมก่อนเสมอ** ใช้ของเดิมถ้ามี ห้ามสร้าง Repo, Project หรือ URL ใหม่โดยไม่รับคำสั่ง
2. **ไม่แก้เว็บไซต์จองสนามเดิม** และไม่แตะ LINE OA / Webhook / Automation / ตู้ขายน้ำที่สนามมีอยู่ จนกว่าจะตรวจข้อจำกัดและได้รับอนุญาต
3. สร้าง **ระบบหลังบ้านแยกบทบาท** สำหรับงานการตลาดและการจัดการสต็อก ไม่ใช่การสร้างเว็บจองสนามใหม่
4. ทุกฟีเจอร์ที่อ้างว่าใช้งานจริงต้องบันทึกลงฐานข้อมูล, refresh แล้วอยู่, มี validation, permission, loading/error/success และตรวจสอบประวัติได้ตามความจำเป็น
5. **ห้ามใช้ตัวเลข Demo ใน Production โดยไม่ติดป้าย Demo** หากไม่เชื่อมข้อมูลให้แสดง Empty State, Manual หรือ Imported ตามจริง
6. UI/UX: Mobile First; iPhone Safari, LINE in-app browser, Android, iPad, Desktop; ไม่มี horizontal overflow, element ซ้อน, input zoom, keyboard บังปุ่ม
7. Workflow เมื่อได้รับคำสั่งแก้เว็บที่มี repo แล้ว: fetch `origin/main` → branch เฉพาะงาน → แก้เฉพาะ scope → test → commit → merge → deploy ผ่านโครงการ Vercel เดิม → ตรวจ Production จริง → รายงาน URL/commit. ถ้า deployment ไม่สำเร็จ ห้ามระบุว่าเสร็จ
8. **ทุกสิ่งที่ไม่ได้ขอให้เปลี่ยน ต้องคงเดิม** (What I did not ask to change must remain unchanged.)

## 1. เป้าหมายธุรกิจและขอบเขต

**Why:** ผู้ดูแลต้องทำโปสเตอร์ โพสต์ Facebook/Instagram/TikTok ตอบ/ติดตามลูกค้าจาก LINE วางแผนโปรโมชั่น คำนวณจุดคุ้มทุน ตั้ง Social Target สรุป KPI รายงานผู้บริหาร และดูแลสต็อกเครื่องดื่มหลายประเภทกับการสั่งซื้อเอง ระบบที่เสนอเป็นศูนย์กลางงานและข้อมูลที่ใช้วางแผน → ทำงาน → วัดผล → ตัดสินใจ

**Business outcomes** (ต้องวัดหลังได้ baseline ไม่ใช่คำรับประกัน): ลดเวลาทำรายงาน/งานซ้ำ, ลดของขาดและสั่งซื้อผิด, เพิ่มความแม่นยำแคมเปญ, ติดตามเป้าหมายของแต่ละแพลตฟอร์มได้, วัดยอดจอง/ผลตอบแทนที่มีข้อมูลพิสูจน์ได้

**Confirmed / ข้อกำหนดยืนยันจากบทสนทนา**
- ใช้แบรนด์ **Wonder Courts**; งานบริหารการตลาด + operations inventory + executive reports
- มีเว็บไซต์สนามอยู่แล้ว **ห้ามทำเว็บจองซ้ำ**
- LINE OA / ระบบเก่ามีโอกาสเชื่อมอยู่แล้ว → เริ่มจาก **บันทึก/นำเข้าข้อมูลเอง** ไม่ไปเปลี่ยน webhook
- เครื่องดื่มมี **หลายประเภท หลาย SKU**; มีงานตรวจนับ คำนวณ และสั่งซื้อเอง
- รูปแบบตู้ขายน้ำ **ยังไม่ยืนยัน** (ตู้ธรรมดา / QR ปลดล็อก / smart vending)
- ต้องมีหน้าจอ PC / iPad / iPhone และภาพแต่ละหน้าแยก ไม่รวมหลายจอในภาพเดียวเมื่อส่งตรวจแบบ
- ดีไซน์อ้างอิงต้อง **สว่าง ขาว–ฟ้าเป็นหลัก** ชมพูเฉพาะ accent; แสง/เงา/โปร่งเหมือนภาพต้นฉบับ

**Pending / ต้องตรวจหน้างาน**
- ระบบจองเดิมมี API/CSV/Excel/รายงานรายการจองหรือไม่, ฟิลด์อะไร, สิทธิ์ใคร
- รายละเอียด LINE OA เดิม (Provider, Chat tool, export) และสิทธิ์ข้อมูล
- ราคาจริงของสนาม, ประเภทสนาม, ช่วง Peak/Off-peak และต้นทุนผันแปร/คงที่
- รุ่นตู้ขายน้ำ วิธีชำระเงิน ออกรายงาน/API หรือไม่; การขาย/คืนเงิน/สินค้าสูญหายทำอย่างไร
- รายการสินค้า SKU, ราคาทุน, ขนาดแพ็ก/ลัง, suppliers, lead time, อายุสินค้า และคลัง/ตู้จริง
- สิทธิ์คนทำงาน/ผู้อนุมัติ, งบแคมเปญ, ข้อกำหนดแบรนด์และโลโก้จริง
- Repo/Stack/Database/Production URL เดิม: Dev ต้องตรวจ ไม่ตั้งชื่อใหม่เอง

---

## 2. Visual Contract — **ห้ามหลุดธีม**

### 2.1 Visual Master
- ไฟล์: `assets/MASTER_UI_REFERENCE.png` (**ภาพผู้ใช้เลือกเป็นต้นฉบับ**; 1448×1086 px เป็น reference image ไม่ใช่ viewport spec)
- ลำดับความสำคัญเมื่อสี/CSS ขัดกัน: **(1) ภาพต้นฉบับที่ผู้ใช้เลือก > (2) Visual Contract นี้ > (3) token ค่าเริ่มต้น**
- อย่าใช้ภาพที่สร้างใหม่มาเปลี่ยน layout, ความฟุ้ง, เงา หรือขนาดการ์ดเอง
- อย่าใช้ชุด mockups 90 ภาพก่อนหน้าเป็น design master; สามารถอ้างได้เพียงชื่อหน้าระบบ/ฟังก์ชันที่มีการยืนยัน

### 2.2 สิ่งที่ต้องเหมือนต้นฉบับ
| Element | Required appearance | Forbidden |
|---|---|---|
| Page background | ขาวสว่างมาก มีฟ้าอ่อนฟุ้งบริเวณขอบและด้านซ้าย, ambient light เบา ๆ | พื้นหลังเทา/ม่วงหม่น/ชมพูเต็มหน้า/gradient แรง |
| Surface / Card | ขาว/ขาวกึ่งโปร่ง มีมิติ layered surface, soft translucency | การ์ดทึบ flat สีเทา หรือ border หนา |
| Shadow | ฟุ้งกว้าง จาง ซ้อนกันอย่างนุ่มนวล | เงาดำชัด เงาแข็ง เงาสั้นเป็นขอบ |
| Sidebar PC | rail แคบด้านซ้าย, ปุ่มวงกลมขาว, active เป็นวงกลมชมพู | dark sidebar, แถบชมพูใหญ่, เมนูข้อความยาวถาวร |
| Accent | ชมพูพาสเทลใช้เฉพาะ active, icons, graph/CTA; ตัวช่วยใช้ฟ้า/ม่วง/เขียวพาสเทล | ใช้ชมพูเป็นพื้นหลังส่วนใหญ่ หรือ neon saturated |
| Cards | มุมมนมาก ปราศจาก border แรง padding/whitespace ตามภาพ | การ์ดเหลี่ยม, ระยะห่างแน่น, card สูงเกิน content |
| Charts | เส้นบาง สีชมพู + fill จาง, donut pastel | หนักแน่น/มืด/สีจัดเต็มพื้นที่ |
| Typography | ข้อความเข้มคมชัด Thai friendly; ค่าตัวเลขเด่น, secondary เทาอ่อนอ่านได้ | ฟอนต์เบลอ ตัวเล็กจนอ่านไม่ได้ |
| Tennis imagery | hero แบนเนอร์เทนนิสอ่อนหวานตามต้นฉบับ | รูปกีฬากระจายเต็มทุกการ์ด/เปลี่ยนธีม |

### 2.3 Design tokens (ค่าเริ่มต้นสำหรับคาลิเบรต — ต้องเทียบภาพจริง)
ใช้ไฟล์ `DESIGN_TOKENS.css` เป็นเพียง **จุดเริ่ม**; เทียบ screenshot ที่ viewport เหมาะสมก่อนอนุมัติ. ห้ามอ้างว่า HEX/opacity ตรงต้นฉบับแบบ pixel-exact เพราะภาพต้นฉบับเป็นภาพเรนเดอร์

- Base: white `#FFFFFF`, near white blue `#F8FCFF`, light sky `#E8F5FF`
- Primary accent: pink `#F36EA5` (ปรับตามภาพจริง); text `#1E2230`; muted `#777E8D`
- Cards: near-white translucent over soft backdrop, blur 14–22px; radius 22–28px; edge 1px low-opacity white
- Soft elevation: large diffuse shadow, extremely low alpha, no harsh bottom border
- Active navigation: pink circle, white outline icon; other rail actions white circles with charcoal SVG
- Maintain semantic tokens: success green only for success/positive; warning amber; error red; avoid decorative status colors
- Icons: Lucide SVG / SVG assets, consistent stroke weight. ไม่ใช้ emoji เป็นไอคอน UI
- Font: choose Thai-capable web font that visually matches the reference, fallback system; do not share/embed proprietary font files without rights

### 2.4 Responsive + viewport acceptance
| Device | Baseline CSS viewport to test | Layout |
|---|---:|---|
| Desktop | 1440×900 (plus 1280/1920 widths) | icon rail left, 4 KPI across if fits, panels 3 columns, lower rows 2 columns |
| iPad portrait | 820×1180 (also landscape) | rail compact or adaptive navigation, 2-column cards where they fit, tap areas adequate |
| iPhone | 393×852 (also 375×667, 390×844, 430×932) | single column for dense content; 2-column KPI only if legible; bottom navigation + more menu |

- Viewport size is **CSS pixel design target**, not the required bitmap output resolution; scroll vertically for additional content instead of squashing everything into one screen
- Main content and all wrappers: `max-width:100%`, `min-width:0`, mobile grid use `minmax(0,1fr)`, no horizontal scroll
- iOS `input, textarea, select { font-size:16px; max-width:100%; min-width:0; }` and do not prevent zoom with viewport flags
- Date/time: Native Picker available on Safari/LINE; on mobile **separate full-width rows**, no `appearance:none` on native input; show selected values clearly
- Fixed bottom bars respect `env(safe-area-inset-bottom)`, keyboard / visual viewport; not cover field or submit button
- Forms: labels, inline errors, don't discard entered values, submit loading/duplicate prevention, unsaved-change warning when needed
- Design breakpoints based on **content fit** not device name alone; test with long Thai text and large accessibility font

### 2.5 Visual QA gate
Before implementing *any* next screen, first implement desktop Home from master image, record screenshot at agreed viewport, overlay/side-by-side compare **background brightness, glow gradient, transparency, shadows, radii, spacing, typography, rail geometry, CTA accents**. Then implement iPhone/iPad Home and obtain sign-off. Only after theme gate passes, build shared `AppShell/Card/KPI/Chart/Control/Sidebar/BottomNav` and reuse them everywhere. **Do not batch 30 pages while the baseline is still visually wrong.**

---

## 3. Information architecture + 30 screens

**Main navigation:** Home / Marketing / Content / Customers / Inventory / Reports. Under administration: Tasks & Approval / Data Import / Team & Roles / Settings / Audit. Sidebar is icon-only on PC; mobile bottom nav is limited to essentials with More menu.

| ID | Route suggestion* | Screen | Content + action required | Priority |
|---|---|---|---|---|
| S01 | `/` | Home Dashboard | KPI summaries, today tasks, alerts, modules, timestamps/source badges | P0 |
| S02 | `/marketing` | Marketing Overview | overview of channel/campaign targets, spend, performance | P0 |
| S03 | `/marketing/social` | Social Performance | FB/IG/TikTok/LINE target vs actual, period filters, source labels | P0 |
| S04 | `/marketing/targets` | Target Planner | create/edit monthly channel KPI targets, calculate gap, reverse planning | P0 |
| S05 | `/marketing/campaigns` | Campaign List | create, filter, status, cost, attribution | P0 |
| S06 | `/marketing/campaigns/:id` | Campaign Editor | budget, dates, channel, objectives, UTM/code, linked content, save | P0 |
| S07 | `/marketing/promotions` | Promotion List | proposed/approved/live/expired, eligibility, guardrails | P0 |
| S08 | `/marketing/promotions/simulator` | Promotion Simulator | scenarios, break-even, price, costs, hours, margin, submit draft | P0 |
| S09 | `/marketing/promotions/:id/approval` | Promotion Approval | review assumptions, approve/reject with reason, audit | P1 |
| S10 | `/content/calendar` | Content Calendar | month/week/list, drag only if accessible, scheduled/published/status | P0 |
| S11 | `/content/tasks` | Content Tasks | backlog/priority/owner/due dates | P0 |
| S12 | `/content/:id` | Content Editor | brief, channels, caption, media, checklist, status, preview | P0 |
| S13 | `/content/library` | Media Library | uploads, preview, remove, tag, search, usage rights | P0 |
| S14 | `/customers` | Lead CRM | manual lead list, source, stage, filters, dedup, consent | P1 |
| S15 | `/customers/:id` | Customer/Lead Detail | contact history, notes, campaign, verifiable booking status | P1 |
| S16 | `/customers/followups` | LINE Follow-ups | manually track outreach and follow-up; no LINE webhook overwrite | P1 |
| S17 | `/inventory` | Inventory Overview | SKU alerts, movement, stock value, in-cabinet vs warehouse | P0 |
| S18 | `/inventory/products` | Products & SKU | product CRUD, brand/size/flavour, cost/price/pack/barcode | P0 |
| S19 | `/inventory/movements` | Stock Movement | receive/transfer/sale/damage/expiry/adjustment, log | P0 |
| S20 | `/inventory/reorder` | Reorder Calculator | daily sales, lead days, buffer, outstanding PO, pack rounding | P0 |
| S21 | `/inventory/purchase-orders` | Purchase Orders | create, approve, send/download, status, supplier | P0 |
| S22 | `/inventory/purchase-orders/:id` | PO Detail | item lines, partial receipt, costs, history, discrepancy | P0 |
| S23 | `/inventory/counts` | Stock Count | count by location, discrepancy, approval for adjustments | P0 |
| S24 | `/inventory/suppliers` | Suppliers | contacts, lead time, price list, MOQ, status | P0 |
| S25 | `/reports/kpi` | KPI Analytics | metric definitions, period/channel/location filters, target comparisons | P0 |
| S26 | `/reports/executive` | Executive Reports | monthly summary, trend, notes, PDF/Excel export | P1 |
| S27 | `/tasks/approvals` | Tasks & Approval | assigned tasks, due, approver, events, history | P0 |
| S28 | `/admin/imports` | Data Import | CSV/XLSX preview, mapping, validation, duplicate, job history | P0 |
| S29 | `/admin/access` | Roles & Permissions | admin-controlled roles, least privilege, no self-escalation | P0 |
| S30 | `/admin/settings` | Settings & Audit | business config, integrations status, audit/event log | P0 |

*Routes เป็นข้อเสนอ ไม่ใช่ข้อกำหนดให้เปลี่ยน URL/Router เดิมหาก repo มีโครงสร้างที่ผ่านแล้ว

**Additional essential screen states** (ไม่ได้แปลว่า 30 หน้าเพียงพอสำหรับ production): login/forgot password, empty/loading/error, no-permission, create/edit modal, confirm destructive action, upload preview/error/retry, offline/failed sync, not found, stale data/source badge, print view and success feedback. All must follow same theme.

---

## 4. Functional requirements / Business rules (Traceability)

### R-MKT-01 Campaigns
- Campaign fields: name, objective, channels, owner, start/end (Asia/Bangkok), planned/actual spend, status draft/approval/live/ended, target, links/UTMs, promo association
- Attach content and paid bookings that can be **verifiably** attributed; manually input evidence if no integration
- Budget calculations: planned vs actual, deviation, booked revenue and attributable contribution clearly separated
- Acceptance: create/edit/save → refresh persists; validations; duplicate prevention; delete/close respects permission; change logged

### R-SOC-01 Social KPI and targets
- Per platform/per metric/per month: target, actual, unit/denominator, entry source (manual/import/API), last updated, editor
- Supported examples: Reach, Impressions, Views, Engagement, Profile Visits, Link Clicks, Leads, Paid Bookings, Spend; LINE OA friend growth, broadcast engagements where available
- Achievement `actual/target*100` (when target>0); growth `(current-previous)/previous*100` (when previous>0); label N/A rather than infinity
- **Do not sum Reach across platforms as unique people.** Only sum strictly additive, identically defined metrics or show per-channel values
- When FB/IG/TikTok/LINE APIs unavailable, data manual/imported; do not invent sync states
- Target reverse planning `required qualified leads = ceil(target paid bookings / assumed lead-to-booking rate)`; show assumption
- Acceptance: user edits 4 channel targets, saves, refreshes, charts and percentages update; source/time displayed; N/A for missing data

### R-PRO-01 Promotion planner + calculator
- Configurable rates by court/zone/date/time (350/450/600 THB/h are historical **example**, not confirmed current rates)
- Inputs: base price P, discount d, promo price P'=P*(1-d), variable cost/h C, baseline sold hours B, expected promo sold hours H, campaign spend A, incremental rewards/costs X
- `baseline_contribution = B * (P-C)`
- `campaign_contribution = H * (P'-C) - A - X`
- `incremental_contribution = campaign_contribution - baseline_contribution`
- `break_even_hours = ceil((baseline_contribution + A + X)/(P'-C))` if `(P'-C)>0`, else show not feasible; respect available slot capacity
- Simulate worst/base/best scenarios; discount applied to **all qualifying promotional hours**, not only additional hours
- Example: P450, d10%, C100, B4, H7, A300, X0 → promo405; baseline1,400; after1,835; incremental **+435 THB**; break-even **6 hours**
- Restrictions: campaign date/time, eligible court, cap, conflict check, approver, code uniqueness. Do not auto-publish to booking website
- Acceptance: calculation matches sample; 0/negative contribution denominator safe; manager approval required if configured

### R-CNT-01 Content and media
- Brief fields: channel, content pillar, target audience, asset dimensions, message, copy/caption, hashtag, CTA, campaign ID, owner, due, publishing date/time, status
- Content states: Draft → In Review → Approved → Scheduled → Published (with rejected/rework/cancelled paths)
- Version history/copy; media upload **real** to configured storage with preview/remove/error/retry/file limit; must not claim scheduled publication unless actually connected
- Export assets/copy for manual posting when no platform posting API
- Acceptance: create task/attach media, review, approval, mark published, update performance later

### R-CRM-01 Leads and LINE follow-ups
- Lead stages: New → Contacted → Interested → Booking Pending → Paid (verified) / Lost
- Source: FB/IG/TikTok/LINE/referral/site/other with campaign code; store consent and minimum necessary contact fields
- **No claim of auto-reading LINE chats.** Manual status and notes are sufficient for Phase 1/2; avoid overwriting LINE OA configuration
- Paid booking must link to real imported/verified transaction; otherwise mark self-reported/pending verification
- KPIs: qualified-lead-to-paid booking rate, follow-up SLAs when timing data exists, repeat customers only if reliable identity match
- Acceptance: no chat permission bypass; user with limited role cannot view restricted customer data

### R-INV-01 Products / Locations / Stock ledger
- SKU unique by brand/type/flavour/size/pack/barcode where applicable; separate inventory locations **Warehouse vs Vending Cabinet** (and further cabinets when needed)
- Movement types: PURCHASE_RECEIPT, TRANSFER_IN/OUT, SALE, RETURN, DAMAGE, EXPIRED, COUNT_ADJUSTMENT; every event has qty/unit, source/dest, reason, reference, actor, timestamp
- **Refilling cabinet = stock transfer; not sale.** Stock should decrement on verified sale or authorized manual sale/adjustment, depending on actual cabinet mechanism
- Stock ledger is immutable; corrections as reversing adjustments, not silent balance edits
- Prevent negative stock unless explicitly configured and permissioned; concurrency-safe transactions
- Cost method: configurable weighted-average purchase cost unless finance chooses FIFO; do not conflate revenue with gross profit
- Acceptance: receive 24 to warehouse → transfer 12 to cabinet: global stock unchanged (24), locations 12/12; sell 3 from cabinet → cabinet 9, global 21; refresh persistent

### R-INV-02 Reorder planner
- Inputs per SKU: avg units/day (7/30 day basis with date/units), supplier lead time L, buffer days S, review period R, inventory on hand OH, open PO units OO, backorders/reserved RO, pack size K, supplier MOQ
- `safety_stock = average_daily_sales*S`
- `reorder_point = average_daily_sales*L + safety_stock`
- `inventory_position = OH + OO - RO`
- `target_stock = average_daily_sales*(L+S+R)`
- If inventory_position <= reorder_point, recommended units = round up `max(0,target_stock-inventory_position)` to pack size K and apply MOQ; otherwise recommend 0 (unless reorder on demand)
- Show assumptions/rounding, supplier minimums, cost estimate and delivery date, allow authorized override with reason
- Need proper no-history fallback: manual forecast, label as estimate
- Acceptance: pack rounding to full units; items on order counted; different cabinet vs warehouse totals not double counted

### R-INV-03 Purchase order and stock count
- PO states Draft → Pending Approval → Approved → Ordered → Partially Received → Received/Closed/Cancelled; guard transitions
- Item lines: SKU, packs, units/pack, unit cost, discount/tax/freight when relevant, supplier; totals reliable to satang
- Receiving supports partial deliveries, shortages, wrong products, timestamps, and ledger movements only on actual receipt
- Stock count freezes/records snapshot, captures counted vs system, requires authorized variance approval for adjustment; keep audit trail
- Supplier cards: terms, MOQ, lead time, delivery days, latest unit cost, contacts
- Acceptance: partial receiving not fully close PO, duplicate receive action cannot increase stock twice

### R-REP-01 KPI and management reports
- KPIs: paid booking count, utilization (occupied paid hours / sellable hours, excluding blocked maintenance), net revenue, revenue per available hour, new customer count, repeat rate cohort/time window, CAC, conversion, campaign costs, incremental contribution, gross margin beverages, stockouts, forecast error, task on-time rate
- Never imply causal incremental lift just because order uses campaign code; distinguish **attributed** vs **incremental (estimated with baseline/control)**
- Monthly report sections: business results, social/channel targets, content output, promotions, customers, inventory/purchasing, risks, next-month actions
- PDF/Excel exports when implemented, with report period, definitions, data source, generated timestamp and disclaimer for partial coverage
- Acceptance: source data reconciled; filters reflect same data; export totals equal UI summary

### R-OPS-01 Work/approval/audit
- Tasks with owner, due, status, priority, comments, attachments; approvals for promotion, purchase order, stock adjustment as configured
- No self-approval if policy disallows; log `who/what/before/after/when/source` for all sensitive changes
- Notifications are in-app at minimum; external alerts only with explicit integrations and user controls

### R-IMP-01 Import and integrations
- CSV/XLSX data import: choose type → upload → preview → column mapping → data validation → duplicate detection → confirm → import report; robust idempotency, rollback/retry strategy
- Store `source`, `import_job_id`, `external_id`, `synced_at`, `verified_at`; manual edit provenance retained
- Existing website/LINE/till/Meta/TikTok API integration requires supported contract, approval, credentials, rate limits and permissions. No third-party API credentials in client code
- If LINE Messaging API webhook in use, **do not point it to the new app** without explicit system-level integration design and owner approval
- Smart fridge integration optional only after onsite assessment of model/SDK/export; do not assume QR unlock proves SKU purchased

---

## 5. Data model (high-level — design normalized schema + migrations)

### Identity & configuration
- `organizations`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `settings`, `audit_events`
- `data_sources`, `integration_connections`, `import_jobs`, `import_rows`, `source_sync_runs`

### Marketing and social
- `social_accounts`, `social_metric_definitions`, `social_metric_snapshots`, `social_targets`
- `campaigns`, `campaign_channels`, `campaign_spend`, `campaign_tracking_links`, `promotions`, `promotion_scenarios`, `promotion_approvals`
- `content_items`, `content_publications`, `content_assets`, `media_assets`, `tasks`, `task_approvals`, `task_comments`
- `leads`, `customer_profiles`, `lead_activities`, `lead_campaign_sources`, `bookings_imported` (if permitted), `booking_attribution`

### Inventory
- `products`, `product_variants`/`skus`, `suppliers`, `supplier_products`, `inventory_locations`, `stock_movements`, `stock_balances` (derived or transactionally maintained), `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `stock_counts`, `stock_count_lines`

**Data rules:** PK UUID, FK indexes, unique constraints for SKU/external IDs, soft delete where needed, money stored as decimal/cents (not JS floats for accounting), quantity units converted explicitly, timezone `Asia/Bangkok`, user access server-enforced, dates UTC stored with local display as appropriate, uploaded assets access-controlled and backed up. Avoid duplicate booking records on repeat import. Audit every financial or stock-affecting change.

---

## 6. Roles and permissions (proposed; confirm with management)

| Action / Role | Owner/Admin | Executive | Marketing | Inventory |
|---|:---:|:---:|:---:|:---:|
| View cross-business summary | ✅ | ✅ | Limited | Limited |
| Edit campaign/content | ✅ | Review | ✅ | — |
| Approve promotion | ✅ | ✅ (if appointed) | Submit | — |
| Manage social targets | ✅ | View | ✅ | — |
| Read customer personal info | Authorized | Aggregates | Need-to-know | — |
| Product/stock/PO | ✅ | View | View alerts only | ✅ |
| Approve PO/stock variance | ✅ | Assigned | — | Submit |
| Manage roles/integrations | ✅ | — | — | — |
| Access audit logs | ✅ | View | Own actions | Own actions |

Implement **backend RLS/ACL** as primary enforcement, UI hiding alone is insufficient. All role definitions adjustable only by authorized administrators. Never let a user change their own role via profile UI.

---

## 7. Flow specifications (clickable path / expected behavior)

**Flow F01 — Social Target**  
Social → choose platform/metric/month → input target → save → import/manual actual → source/time shown → target progress recalculated → open channel detail → include in report. Validate denominator and units.

**Flow F02 — Promotion**  
Promotion list → New → choose court/date/time/rate/cost/budget → run best/base/worst simulator → inspect break-even and capacity → Save Draft → Request Approval → Approve/Reject → mark Active only after approved (activation on existing booking website requires separate integration) → enter/verify results → performance report.

**Flow F03 — Content**  
Calendar → New brief → create tasks/assign → upload image/video and caption → preview by channel → submit review → approve → mark published manually or use approved integration → enter result or import stats → link campaign.

**Flow F04 — Lead follow-up**  
Lead created manually/import → add source/campaign → update stage/contact notes → link real booking proof if available → follow-up due notification → close won/lost and report. **Not a LINE chat replacement.**

**Flow F05 — Beverage inventory**  
Create SKU + supplier + pack size → register opening stock by location → stock receipt into warehouse → transfer to vending cabinet → record paid sale / imported sales report → calculate demand and reorder alert → draft PO → approve → send → receive partial/full → reconcile count and profit report.

**Flow F06 — Executive Report**  
Select period → show completeness/source freshness → KPI with actual vs target vs previous period → explanation and insights → export/print with disclaimers → store report snapshot/version.

**Flow F07 — Data import**  
Select category → upload → preview → mapping → resolve validation/errors → dedupe → confirm → result counts/error list → audit; retry must not duplicate transactions.

---

## 8. Non-functional requirements / engineering

**Stack:** Follow existing repo/stack/deployment wherever available. For new architecture decisions within approved existing project, prefer typed frontend, accessible components, centralized state/data fetching, server validation, Postgres or existing persistent DB, object storage, controlled background ingestion. This is guidance only; do **not** provision services/projects without authorization.

**Performance:** mobile-first; server pagination/filters for large tables; debounce search; avoid heavy blur/backdrop performance regression on older iPhone; image optimization; accessible reduced-motion. Set measurable budgets after checking existing app.

**Security:** Auth sessions, least privilege, route/action checks server-side, secrets in server environment, CSRF/XSS protections, validation, signed/permissioned downloads, audit logs, rate limiting on writes, no PII in analytics/log output unnecessarily; data retention/consent under applicable Thai PDPA rules.

**Reliability:** idempotent financial/stock mutations, DB transaction/locking, import retry, clear offline/error status, backup/restore strategy, timestamps, reconciliation with source system; safe handling of failed API sync, never silently show stale data as live.

**Accessibility:** keyboard navigation, focused visible states, text contrast, readable Thai fonts, form labels and error messages, 44px touch targets where possible, responsive to zoom; no interaction available only by hovering.

**Quality:** unit tests for all calculations, API/integration tests, role/security tests, E2E critical workflows; visual regression for Home and shared components at desktop/tablet/mobile.

---

## 9. Phased delivery and dependency policy

**P0 — Functional MVP, no external integration dependency:** Auth + roles, main shell approved UI, Home with source/status indicators, manual/imported social KPI + target planner, campaigns/content/calendar/media/tasks, Promotion Calculator, inventory SKU/location/ledger/reorder/PO/stock count/supplier, data imports, basic KPI dashboard and audit trail. No fake publishing/booking/chat automation.

**P1 — Operations analytics and approvals:** CRM/LINE follow-up manual, promo/PO approval flows, advanced analytics, executive PDF/Excel, attribution with reliable source evidence.

**P2 — Approved integrations/advanced:** authorized booking data feed, Meta/TikTok/LINE metrics API where supported, cabinet/vending sales export, scheduled syncs, improved demand forecast and campaign recommendations based on sufficient data.

**Dependency:** external API/blocker must not block fully functional P0 manual/import workflows. If backend, auth, persistence or audit is missing, label Prototype/Demo instead of Production.

---

## 10. Definition of Done (must pass before stating finished)

### Visual (hard gate)
- [ ] PC Home screenshot visually calibrated against **actual master reference image**, not previous mockups
- [ ] Same warm white/ice-blue brightness, diffuse shadows, translucent cards, roundness, icon rail, accents and spacing
- [ ] iPhone and iPad reuse exact design tokens and components, adapting only layout (not redesigning look)
- [ ] No overflow at 375, 390, 393, 430, 820, 1024, 1280 and 1440 CSS widths; tables/cards not clipped
- [ ] Mobile forms input >=16px, native date/time pickers, safe-area, keyboard-safe submit

### Functional
- [ ] CRUD persists after reload; data is scoped by organization and role
- [ ] Promotion +435 THB sample and 6-hour break-even verified by automated tests
- [ ] Target progress and N/A guard verified; social Reach not misrepresented
- [ ] Inventory transfer does not become sale; partial receiving, duplicates, negative balance and stock count handled correctly
- [ ] Supplier/PO quantities round by pack and track on-order units correctly
- [ ] No integration configured = manual/imported mode accurately displayed (no fake sync)
- [ ] Customer/LINE and website original untouched by default
- [ ] Upload preview/remove/retry and import mapping/validation/error handling functional
- [ ] Logs, loading, empty, error, success, confirmation and permission states all designed and tested
- [ ] Exports match dashboard data and label sources/disclaimers

### Delivery
- [ ] Inspect existing repo/project, `fetch origin main`, use scoped branch, preserve unrelated functions
- [ ] Tests and build pass; commit/merge with clear diff
- [ ] Deploy to **existing** authorized Vercel Production project, check actual URL and key actions on iPhone-width viewport
- [ ] Provide production URL, commit SHA, migrated schema, test evidence, pending known blockers, integration status

---

## 11. Questions Dev should resolve at kickoff (do not block initial UI/theme calibration)

1. Existing repo / frontend / backend / DB / Vercel URL and who owns them?
2. Booking site: export formats, authorization, booked vs paid vs cancelled fields, time slots, revenue definitions?
3. Existing LINE OA: connected service, webhook ownership, permitted export? **Do not alter live connection.**
4. Cabinet: standard cooler / QR unlocked / smart vending, manufacturer, sales settlement, transaction export, multi-product detection?
5. Inventory: SKU photos/list, warehouse vs cabinet locations, supplier lead time, unit conversion, open POs, payment ownership, lost/expired policy?
6. Management: target KPIs, court price table/costs, promo limit, who approves spending and stock adjustments?
7. Brand: exact authorized logo, official banner/tennis photos, typography licenses, and approval of PC Home pixel-level visual outcome?

---

## 12. Handoff files and how to use them

- `WONDER_COURTS_RCM_DEV_HANDOFF.md` — authoritative requirements/context + screen matrix + business formulas + QA
- `assets/MASTER_UI_REFERENCE.png` — **authoritative visual reference from user**; do not replace
- `DESIGN_TOKENS.css` — CSS *initial values only*, must tune by comparing to master image
- `README_FIRST.md` — short start sequence for Dev

**Final directive:** วางโครงสร้างบนของเดิม, สร้างเฉพาะ scope ที่สั่ง, ทำงานจริงพร้อมความปลอดภัย, และใช้ภาพ Master เป็น visual contract ที่ยืนยันแล้ว หาก UI ยังไม่ตรง **ห้ามข้ามไปทำหน้าถัดไปโดยอ้างว่าธีมผ่านแล้ว**.
