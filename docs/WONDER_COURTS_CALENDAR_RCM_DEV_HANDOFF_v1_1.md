# WONDER COURTS — CALENDAR RCM / DEV HANDOFF

**Document ID:** WC-CAL-RCM-001  
**Version:** 1.1 (Design-Locked / Implementation Ready)  
**Scope:** `Calendar — Day View` + `Calendar — Month View` + กลไกที่ทำให้สองหน้าทำงานจริง  
**Platform:** Responsive Web/PWA-compatible Web (ไม่จำเป็นต้องเป็น Native App)  
**Locale:** `th-TH`; เวลา `Asia/Bangkok`; แสดงปี พ.ศ. ให้ผู้ใช้ แต่จัดเก็บปี ค.ศ. รูป ISO 8601  
**Status:** **สเปกสำหรับส่งต่อ Dev** — ไม่ใช่หลักฐานว่าพัฒนา/ทดสอบ/Deploy แล้ว  
**Design authority:** รูปสองรูปที่แนบมาใน `reference/` เท่านั้น

> **ข้อบังคับที่สำคัญที่สุด (DESIGN LOCK):** ภาพ `MASTER_DAY_REFERENCE.png` และ `MASTER_MONTH_REFERENCE.png` คือ **Visual Source of Truth** สำหรับ UI สองหน้านี้ ต้องรักษา *สีขาวอมฟ้าสว่าง ความโปร่ง ความฟุ้งของแสง เงานุ่ม มุมโค้ง ขนาด/น้ำหนักตัวหนังสือ ระยะห่าง ไอคอน และลำดับองค์ประกอบ* โดยห้ามตีความใหม่เป็นธีม SaaS แบบอื่น ห้ามใช้ชุดภาพ 90 หน้าก่อนหน้าที่ผู้ใช้ปฏิเสธเป็นหลักฐานดีไซน์ ห้ามปรับให้เข้ม/ทึบ/เทา/อมม่วง/ชมพูทั้งหน้าจอเอง

---

## 0. สิ่งที่ Dev ต้องอ่านก่อนลงมือ (Read First)

1. เปิดภาพ `reference/MASTER_DAY_REFERENCE.png` และ `reference/MASTER_MONTH_REFERENCE.png` เทียบแบบข้างกัน ในสเกลเดียวกัน
2. อ่านเอกสารนี้ทั้งหมด โดยเฉพาะส่วน **Visual Contract**, **Interaction Contract**, **Data Contract**, **QA / Definition of Done**
3. อ่าน `spec/CALENDAR_DESIGN_TOKENS.css` (เป็น **ค่าเริ่มต้น** ที่ต้องเทียบภาพอีกครั้ง ไม่ใช่ข้ออ้างว่าใช้ token แล้วภาพจะตรงโดยอัตโนมัติ)
4. อ่าน `qa/CALENDAR_ACCEPTANCE_TESTS.md` และตัวอย่างข้อมูล `spec/CALENDAR_EVENT_FIXTURES.json`
5. ตรวจ **Repo/Project/Deployment เดิมก่อน** ห้ามสร้าง Repo, Vercel Project, URL หรือระบบจองใหม่โดยไม่ได้สั่ง
6. ทำ **Day และ Month บน iPhone ให้ผ่าน visual review ก่อน** จึงค่อยขยาย iPad/PC และเชื่อมข้อมูลจริง
7. ใช้ภาพต้นฉบับในการเทียบภาพ ไม่ใช้ภาพ PNG ทั้งหน้าแทน HTML จริง: ปุ่ม ตัวหนังสือ ปฏิทิน แถบเวลา และกิจกรรมต้องเป็น DOM/Components ที่กดและอ่านด้วยเทคโนโลยีช่วยเหลือได้

### 0.1 ขอบเขตที่ล็อก (In Scope)
- ปฏิทินรายวันแนว Timeline และปฏิทินรายเดือนแนว Grid 7 คอลัมน์
- สลับมุมมองโดย **รักษาวันที่เลือก** (`selectedDate`)
- แสดงกิจกรรมจากโปรโมชั่น, แคมเปญ, คอนเทนต์, งาน/นัดหมาย, กิจกรรมสนาม, CRM Follow-up (ตามสิทธิ์), สต็อกและจัดซื้อ, วันหยุด
- เพิ่ม/ดู/แก้ไข/ยกเลิก **รายการที่สร้างในระบบเรา** ด้วยสิทธิ์ที่กำหนด
- แสดงรายการที่เชื่อมมาจากโมดูลเราโดยไม่ทำข้อมูลต้นทางซ้ำ; คลิกไปแก้ในโมดูลเจ้าของข้อมูลได้
- ตัวกรองและแสดงงานตามสิทธิ์; การแจ้งเตือน; ปฏิทินที่ถูกต้องข้ามเดือน/ปี/เขตเวลา
- สถานะ Empty/Loading/Error/Offline และข้อมูลที่เชื่อมต่อไม่ได้
- Responsive จริงสำหรับ iPhone, iPad, Desktop, Safari/LINE in-app browser/Android

### 0.2 นอกขอบเขตที่ห้ามอ้างว่าทำได้ (Out of Scope)
- ไม่สร้างระบบจองสนามของบริษัทใหม่ และไม่แก้เว็บไซต์จองของบริษัทโดยพลการ
- ไม่เปลี่ยน LINE OA Webhook/การเชื่อมต่อ/สิทธิ์ของบริษัท
- ไม่อ้างว่าดึงยอดจอง/แชท/สต็อกจากตู้จริงได้ ถ้ายังไม่มีไฟล์หรือ API ที่ได้รับอนุญาต
- ไม่แสดงข้อมูล Demo ปนกับข้อมูลจริงโดยไม่มีป้าย Demo
- ไม่เพิ่มส่วนลิสต์กิจกรรม **ใต้ปฏิทินรายเดือน** เพราะผู้ใช้ห้ามชัดเจน
- ไม่เพิ่มหัวข้อ, กราฟ, การ์ดสรุป KPI, Legend ใหญ่ หรือรายละเอียดที่ทำให้ภาพสองหน้าหลุดแบบ

### 0.3 กฎลำดับความสำคัญเมื่อข้อกำหนดขัดกัน
1. ความถูกต้องของข้อมูล, ความปลอดภัย, สิทธิ์, ความสามารถในการใช้งานจริง และ Accessibility ที่จำเป็น
2. **Visual Reference ทั้งสองภาพ** สำหรับสี/แสง/เงา/รูปทรง/การจัดองค์ประกอบ
3. พฤติกรรม UX จากบทสนทนาและเอกสาร RCM ฉบับนี้
4. Design Tokens ที่แนบ (ใช้ calibrate จากภาพจริง)
5. แหล่งอ้างอิงหรือแบบร่างเก่าซึ่งผู้ใช้ยังไม่ได้อนุมัติ

หากความเหมือนภาพขัดกับขนาดจอจริง เช่น ความสูงของปฏิทินรายเดือน 6 แถว: **อนุญาตให้เลื่อนหน้าแนวตั้ง** แทนการย่อทุกอย่างจนอ่านไม่ได้ ห้ามใช้การซ่อนข้อมูลหรือบังคับความกว้างเกินจอ

---

# 1. MASTER VISUAL CONTRACT — ห้ามหลุดธีม

## 1.1 ความรู้สึกของภาพที่ต้องได้

- **Bright White / Soft Blue Airy:** มองรวมแล้วขาวสว่าง ฟ้าอ่อนเป็นแสงรอบนอก ไม่ใช่พื้นหลังฟ้าเต็มพื้นที่
- **Translucent / Frosted Glass:** การ์ดเป็นขาวกึ่งโปร่งที่มีความลึก/แสงสะท้อนนุ่ม อ่านตัวหนังสือชัด
- **Soft Diffused Shadow:** เงาฟุ้งกว้าง แรงน้อย ไม่มีเส้นขอบดำหรือเงาคม
- **Pink Accent Only:** ชมพูใช้กับ active tab, วันเลือก, งานโปรโมชั่น, ไอคอน และ FAB; ไม่ใช้ชมพูทึบทั้งหน้า
- **Rounded, Spacious:** มุมมนมาก พื้นที่หายใจพอดี ไม่อัดชิด และไม่สร้างการ์ดยักษ์ที่ว่างเปล่า
- **Subtle Category Tint:** ตัวบ่งชี้กิจกรรมใช้ชมพู/ฟ้า/ม่วง/เขียวพาสเทลที่อ่านง่าย
- **No Strong Calendar Grid:** ปฏิทินรายเดือนห้ามมีเส้นแบ่งช่องเข้มชัดหรือการ์ด 42 ใบที่แยกกรอบแรง; ใช้ระยะห่าง/ไฮไลต์บาง ๆ เป็นตัวแบ่งทางสายตา

## 1.2 Visual tokens ที่ Dev ต้องรักษา

| Token | ค่าเริ่มต้นโดยประมาณ (ให้ calibrate จากภาพ) | กฎการใช้งาน |
|---|---|---|
| Canvas base | `#F9FBFF` / `#FCFDFF` | พื้นขาวเกือบทั้งหมด |
| Ambient blue | `rgba(163,219,250,.20)` | glow ข้างบน/ขอบ ไม่ใช่แผ่นสีทึบ |
| Ambient pink | `rgba(255,207,227,.14)` | เบามากและเป็นจุด |
| Surface | `rgba(255,255,255,.78–.90)` | การ์ดขาวกึ่งโปร่ง |
| Frost blur | `blur(14–24px)` | รักษาความโปร่งแต่ยังอ่านได้ |
| Main text | `#161925` | หัวเรื่อง/วันที่ |
| Secondary text | `#657087` | คำอธิบาย/เวลา |
| Muted date | `#ADB4C2` | วันนอกเดือน |
| Pink accent | `#F46C9A` (ปรับจาก reference) | วันที่เลือก/FAB/active |
| Pink tint | `#FCE7F0` | เฉพาะพื้นไฮไลต์อ่อน ๆ |
| Blue | `#35B9EA` | คอนเทนต์ |
| Lavender | `#AC75E7` | นัดหมาย/กิจกรรมทีม |
| Green | `#3BCE82` | สต็อก/Operations |
| Shadow | `0 14px 40px rgba(99,126,172,.09)` | ทิศทางเงานุ่ม ไม่คม |
| Card radius | `24–30px` | ปรับตามสัดส่วนจริงของแต่ละอุปกรณ์ |
| Circle controls | วงกลมขาว + เงานุ่ม | ห้ามใช้ปุ่มแบนมีขอบดำ |

> หมายเหตุทางวิศวกรรม: PNG เป็นภาพ flattened ที่ไม่มี layer CSS จึง **อ่านค่า blur/opacity/shadow ที่เป็นค่าเดิมจริงไม่ได้** ตัวเลขข้างบนคือค่าตั้งต้นเพื่อให้ Dev สร้างภาพเหมือน reference ด้วยการทดสอบเทียบภาพ ไม่ใช่ยืนยันว่าเป็น original exact CSS values

## 1.3 Typography — เงื่อนไขห้ามเปลี่ยน

- ภาษาไทยแนะนำ `Noto Sans Thai`, รองด้วย `Prompt`, system sans-serif; ให้ทดสอบทรงตัวอักษรเทียบรูปต้นฉบับก่อนอนุมัติ
- ตัวเลขวันที่ในเดือน **Bold/Semibold ตามภาพ** เป็นสิ่งที่เด่นที่สุดในช่องวัน
- **ข้อความรายละเอียดกิจกรรมใน Month ต้องเป็น Regular 400** — ห้าม Bold ตามที่ผู้ใช้กำหนด ยกเว้นตัวเลขวันที่
- ข้อความหัวปฏิทิน/เดือนสามารถ Semibold ได้เพราะไม่ใช่รายละเอียดในช่องวัน
- ใน Day View: ชื่อรายการตาม reference เด่นกว่าคำอธิบายได้ (ประมาณ 600/400), เวลาใช้ medium สีเทาอมฟ้า
- ข้อความที่แสดงบนมือถือจริงต้องอ่านได้ ไม่บีบตัวหนังสือเป็น 8px เพื่อเลี่ยงการล้น; สำหรับ Month ที่แคบ ให้ใช้ shortTitle, ตัดบรรทัด และ `+N` อย่างเหมาะสม
- ใช้สีตัวอักษรให้ผ่าน contrast สำหรับข้อความสำคัญ (WCAG 2.2 AA เท่าที่ทำได้โดยไม่ทำให้ภาพทึบ)

## 1.4 Motion / Interaction feedback

- Hover เงาเพิ่มเล็กน้อยเฉพาะ PC; touch มี pressed state สีอ่อน ไม่ใช้ Zoom แรง
- Transition 120–180ms; รองรับ `prefers-reduced-motion`
- การเลือกวันที่ / เปลี่ยนมุมมอง ไม่ทำให้ layout กระโดด ข้อมูลหาย หรือ scroll ไปตำแหน่งประหลาด
- ปุ่ม FAB, ตัวเลือกวัน, Dropdown ต้องเห็น focus ring สำหรับ keyboard แต่ไม่แสดงเส้นขอบตลอดเวลา

## 1.5 สิ่งที่ห้ามแก้โดยไม่มีคำสั่ง (Non-negotiable visual negatives)

- ห้าม Dark Sidebar, Glass UI สีม่วงเข้ม, การ์ดทึบ, เส้นแบ่ง grid ชัด, Shadow แข็ง
- ห้ามเพิ่มขอบหนาที่ทุกช่องวัน ห้ามใช้ Bold กับรายละเอียดแต่ละวันใน Month
- ห้ามเปลี่ยนโลโก้ Wonder Courts เป็นโลโก้แต่งเอง ใช้ asset ที่บริษัทอนุมัติ (ภาพ reference เป็นตัวอย่างตำแหน่ง)
- ห้ามทำ Month + รายการ agenda แยกด้านล่าง
- ห้ามรวมสองหน้าจอไว้ในภาพเดียวเพื่อขออนุมัติภาพ; สำหรับ QA ส่งภาพ Day/Month แยกอย่างละภาพต่อขนาดจอ
- ห้ามเปลี่ยนเส้นทาง UX หรือเพิ่ม Feature อื่นเองเพียงเพื่อให้ UI ดูเต็ม

---

# 2. GLOBAL SHELL — องค์ประกอบร่วมทั้ง 2 หน้า

| ID | Component | ข้อกำหนด |
|---|---|---|
| UI-G01 | Screen canvas | ขาวฟ้าเบาสว่าง, ambient glow ตามภาพ; ไม่ใช่ background solid gray |
| UI-G02 | Branding | มุมซ้ายบนใช้โลโก้ Wonder Courts จริง; รักษาระยะและสัดส่วนจาก reference |
| UI-G03 | Notifications | วงกลมขาว/ไอคอนเส้น พร้อมจุดชมพูสำหรับ unread; เปิด notification panel ได้จริง |
| UI-G04 | Account avatar | วงกลมชมพูอ่อนด้านขวา; เปิดเมนูบัญชีตามสิทธิ์ ไม่แสดงชื่อบัญชีส่วนตัวปลอม |
| UI-G05 | Date caption | แสดงวัน/วันที่/เดือน/ปี พ.ศ. ถูกต้องและ update ตาม selectedDate; ห้าม hardcode วันที่จากภาพ |
| UI-G06 | View title | Day: “วันนี้” ถ้า selectedDate = วันปัจจุบัน, มิฉะนั้น “ปฏิทินรายวัน” พร้อม date caption ตามวันเลือก; Month: “ปฏิทินรายเดือน” |
| UI-G07 | View picker | ปุ่ม pill ขวาบนตาม reference; กดแล้วสลับ **รายวัน / รายเดือน** (อาจเพิ่ม Week ในอนาคต แต่ไม่แทรกใน MVP) |
| UI-G08 | Bottom navigation | แถบ pill ขาวกึ่งโปร่ง มี 5 ไอคอนเส้น ตำแหน่ง calendar active ชมพู; ระยะห่างเท่ากัน |
| UI-G09 | Scroll | เลื่อนแนวตั้งเฉพาะพื้นที่ content/page; Bottom Nav ไม่ทับ content; ไม่มี horizontal scroll |
| UI-G10 | Floating add button | Day View เท่านั้น ตาม reference; ชมพูวงกลมพร้อม +; เปิด Create Event, เมื่อแสดง keyboard ต้องไม่บังช่องกรอก |
| UI-G11 | Back / deep link | กด Back ของ Browser กลับสถานะก่อนหน้าได้; รองรับ deep links |
| UI-G12 | Data provenance | ถ้าเป็นข้อมูล Imported/Manual แสดง metadata ในรายละเอียด event ไม่ยัดบนการ์ด Month จนรก |

**แก้ข้อมูลวันที่ในภาพต้นฉบับ:** `4 พฤศจิกายน 2569` ตรงกับ **วันพุธ** (Wednesday 2026-11-04) ไม่ใช่พฤหัสบดี ภาพที่มีคำว่า “พฤหัสบดี” เป็นข้อผิดพลาดของ mockup; Dev **ต้องคำนวณวันจริง** ห้ามคัดข้อความผิดลงโปรดักชัน. วันเริ่มสัปดาห์คือ **วันจันทร์** และ 1 พฤศจิกายน 2569 เป็น **วันอาทิตย์**

---

# 3. SCREEN A — DAY VIEW / ปฏิทินรายวัน

**Route recommendation:** `/calendar?view=day&date=2026-11-04`  
**Reference:** `reference/MASTER_DAY_REFERENCE.png`  
**Primary job:** ให้พนักงานดูตารางงานเรียงเวลา จัดการกิจกรรม และกดเข้าไปดูรายละเอียด/ปฏิบัติงาน

## 3.1 โครงหน้าจอจากบนลงล่าง (ห้ามสลับลำดับ)

1. Header: โลโก้ Wonder Courts ซ้าย, notification และ avatar ขวา บนพื้นที่ขาว-ฟ้าโปร่ง
2. Date summary: วันที่แบบไทยตัวรองเหนือหัวเรื่อง “วันนี้” (หรือวันที่ที่เลือก); ทางขวาเป็น **view switcher วงมน** มี icon calendar + chevron
3. **Week strip 7 วัน** การ์ดใหญ่ขาวโปร่งมุมมน: `จ. อ. พ. พฤ. ศ. ส. อา.` พร้อมวันที่; วันเลือกเป็นวง/เม็ดชมพูเด่น; ด้านล่างมีจุดเล็กตามหมวดกิจกรรม
4. **Timeline รายการตามเวลา** เส้นแนวตั้งสีเทาจางซ้ายและหมุดวงกลมโปร่ง/ชมพู; event cards ทางขวา
5. Event card: ไอคอนบนพื้นสีอ่อน, ชื่อเด่น, คำอธิบาย regular, badge หมวด, เวลาอยู่ขวาบน, attendee avatars เฉพาะกรณีมีผู้เข้าร่วมจริง
6. Event card ที่กำลังเลือก: พื้นชมพู tint นุ่มกว่าการ์ดอื่น (reference: ประชุมการตลาด) ขอบ/Glow อ่อนเท่านั้น ไม่ต้องมี outline หนา
7. Floating Add: วงกลมชมพู + ด้านล่างขวาของ content ก่อน bottom dock
8. Sticky Bottom Navigation: 5 icons, Calendar active ชมพู, iPhone safe area

## 3.2 ตัวอย่างกิจกรรมที่ใช้ในการ Review (เป็น Demo เท่านั้น)

| เวลา (Asia/Bangkok) | Type | ชื่อ | Description | UI |
|---|---|---|---|---|
| 09:00 | promotion | เริ่มโปรโมชั่น Off-Peak | เปิดใช้งานโปรเฉพาะวันธรรมดา | icon megaphone + pink |
| 10:00 | content | ถ่ายคอนเทนต์: สนามเทนนิส | ถ่ายคลิป Reels โปรใหม่ | icon video + cyan |
| 13:30 | appointment | ประชุมแผนการตลาด | สรุปแคมเปญเดือนนี้และงบโฆษณา | icon users + lavender/pink selected; avatar ถ้ามีจริง |
| 15:30 | inventory | ตรวจนับสต็อกเครื่องดื่ม | เช็กยอดคงเหลือและเตรียมสั่งซื้อ | icon box + green |

> โปรโมชันที่ครอบคลุมหลายวันจะแสดงใน Day View: แสดง milestone เริ่ม/สิ้นสุดตามวันที่เกิด และสำหรับช่วงวันที่กำลังใช้งานให้แสดง **all-day compact card** เฉพาะวันที่เลือก (สร้างเป็น occurrence ที่ได้จาก range เดิม ไม่เพิ่ม record ใหม่ใน DB) ไม่สร้าง event ซ้ำถาวร (ดูข้อ 5.2)

## 3.3 Behavior Requirement Matrix — Day

| ID | Action | Expected result |
|---|---|---|
| DAY-01 | เปิด `/calendar` ครั้งแรก | Default **`day` แน่นอน**; เริ่มที่วันที่ปัจจุบันของ Asia/Bangkok; ไม่ hardcode 4 พ.ย.; deep link `view=month` ต้อง override default |
| DAY-02 | แตะวันใน Week strip | `selectedDate` เปลี่ยน, timeline เปลี่ยนตาม, วันเลือกชมพู, URL เปลี่ยน, ไม่มี reload ทั้งหน้า |
| DAY-03 | เลื่อนสัปดาห์ | รองรับปุ่ม/gesture ที่ไม่ชน browser navigation; คงวันเลือกหากอยู่ในช่วง หรือเลือกวันที่เหมาะสมและชี้แจง |
| DAY-04 | เปิด View picker | เลือก “รายเดือน” และไป Month โดย **ยัง selectedDate เดิม** |
| DAY-05 | แตะ Event card | เปิด Event Detail Bottom Sheet/Modal/Detail Page ให้ดูข้อมูลครบ; ส่งข้อมูลจาก event ID, ไม่ใช้ข้อความใน DOM เป็นแหล่งข้อมูล |
| DAY-06 | แตะ FAB + | เปิด Create Event form; default start date = selectedDate; default time รอบถัดไป (ปรับได้) |
| DAY-07 | กด Mark Done | ทำได้เฉพาะรายการประเภท task ที่มีสิทธิ์; Meeting/Promotion ไม่ถูกปิดอัตโนมัติด้วยการคลิกเครื่องหมายเช็ก |
| DAY-08 | Event มีผู้เข้าร่วม | แสดง avatar/group label; หากไม่มีรูปใช้ initials; ห้ามสุ่มรูปหน้าคนจริง |
| DAY-09 | Event ซ้อนเวลา | จัดเรียง `startAt` แล้ว status/time; แสดง warning ในรายละเอียดถ้า resource/person ชนกัน; card ยังอ่านได้ |
| DAY-10 | Event ไม่มีเวลา | แสดงกลุ่ม “ทั้งวัน” ตามลำดับเหนือรายการมีเวลา ไม่ fabricate 09:00 |
| DAY-11 | หลายรายการมาก | Timeline เลื่อนแนวตั้งได้; nav ไม่ทับการ์ดสุดท้าย; virtualize เมื่อจำนวนมาก |
| DAY-12 | Event loading/empty | Skeleton นุ่ม / ข้อความ “ยังไม่มีกิจกรรมในวันนี้” + CTA เพิ่มรายการ (ถ้ามีสิทธิ์) |
| DAY-13 | แตะ Notification | เปิดงานที่เกี่ยวข้องเมื่อผู้ใช้มีสิทธิ์; ไม่เผยข้อมูลของบุคคลอื่น |
| DAY-14 | เปิด Month แล้วกลับ Day | วันเลือกเดิมอยู่ครบ; scroll หรือตำแหน่งโฟกัสกลับสมเหตุสมผล |
| DAY-15 | แตะปุ่ม nav Calendar ตอนอยู่หน้า Day | อยู่ใน Calendar หน้าเดิม ไม่ duplicate view หรือสร้าง event |

## 3.4 สถานะของ event card

- `planned`: ไม่มีเครื่องหมายสถานะสำเร็จ
- `in_progress`: subtle tint/status dot; ไม่เปลี่ยนการ์ดเป็นสีจัด
- `pending_approval`: badge เหมาะสม; ไม่แสดงเป็น approved
- `approved`: ในรายละเอียดแสดงผู้อนุมัติ/เวลา
- `completed`: เฉพาะ task; อาจใช้ check และข้อความจางลงเล็กน้อย
- `cancelled`: ไม่แสดงใน default เมื่อ hidden cancelled หรือแสดงด้วย style ขีดฆ่าที่ผู้ใช้เลือก Filter
- `overdue`: สำหรับ Task/Follow-up เท่านั้น ไม่ใช้กับ Event ที่เพียงผ่านเวลาไปแล้ว
- `data_unverified`: บอกว่าบันทึกเอง/นำเข้า ยังไม่ยืนยัน ไม่อ้างว่าเชื่อมระบบจอง

## 3.5 Event detail sheet / หน้าแสดงรายละเอียด

ต้องมีชื่อ, หมวด, วันที่เริ่ม–สิ้นสุด, เวลา/ทั้งวัน, รายละเอียด, สถานะ, ผู้รับผิดชอบ, ผู้ร่วม, ที่มา (`Manual`, `Content`, `Promotion`, `Inventory`...), ลิงก์ต้นทาง, เอกสารแนบที่ได้รับอนุญาต, ประวัติแก้ไข (ตามสิทธิ์), และ action ที่ทำได้จริง (แก้ไข/เลื่อนเวลา/ยกเลิก/กลับไปโมดูลต้นทาง)

ถ้า event มาจาก Promotion/Campaign/Content/Inventory: ปุ่ม **“ไปยังรายการต้นทาง”** เป็น action หลัก; หลีกเลี่ยงแก้ source fields จาก calendar อย่างอิสระเพราะทำให้ข้อมูลสองส่วนไม่ตรงกัน

---

# 4. SCREEN B — MONTH VIEW / ปฏิทินรายเดือน

**Route recommendation:** `/calendar?view=month&date=2026-11-04`  
**Reference:** `reference/MASTER_MONTH_REFERENCE.png`  
**Primary job:** มองเห็นภาพรวมทั้งเดือนและ **อ่านชื่อกิจกรรมสั้น ๆ ในแต่ละวันจากบนปฏิทินทันที** โดยไม่มี agenda list แยกด้านล่าง

## 4.1 Layout locked ตามภาพ

1. Header โลโก้ + notification + avatar เหมือน Day
2. Date caption และหัวเรื่อง **“ปฏิทินรายเดือน”**
3. Pill View switcher ทางขวาบน: icon calendar + คำ “รายเดือน” + chevron ชมพู/พื้นขาว
4. Main Calendar เป็น **การ์ดขาวโปร่งใบเดียว** ขอบมนมากและเงาฟุ้งเบา
5. Month navigation ด้านบนภายในการ์ด: ปุ่ม `‹` ซ้าย, ชื่อเดือน/ปี พ.ศ. กลาง, ปุ่ม `›` ขวา
6. Weekday header 7 ช่อง เรียง จ. → อา.
7. Date grid **7 คอลัมน์เท่ากันทุกคอลัมน์** และทุกแถวในเดือนเดียวกัน **สูงเท่ากัน**
8. วันที่เป็นตัวหนาเป็นหลัก; วันนอกเดือนจาง; วันที่เลือกเป็น pill/circle ชมพูและพื้นหลังชมพูแผ่ว ๆ
9. กิจกรรมของวันนั้นแสดงเป็น Short Event Labels / Pastel Chips ขนาดเล็กภายในช่องวัน; ข้อความ **Regular ไม่ Bold**
10. Footer navigation pill ขาวโปร่ง, Calendar selected ชมพู
11. **ไม่มี “รายการของวันที่เลือก” หรือแผง agenda ใต้ปฏิทิน**

## 4.2 กฎ Calendar Grid ที่ต้องผ่าน 100%

- Start week: **Monday** เท่านั้น; คำนวณวันที่จาก local calendar (ไม่ hardcode layout ตามภาพ)
- Example November 2026: เดือนเริ่ม **Sunday Nov 1**, แสดง 6 แถว (Oct 26–31 และ Dec 1–6) ตามรูป
- CSS ใช้ `grid-template-columns: repeat(7, minmax(0, 1fr))`
- เซลล์มี **fixed/consistent row size per viewport**, ไม่ขยายเฉพาะวันที่มีหลายกิจกรรม; ใช้ `grid-auto-rows` หรือ layout รายสัปดาห์ที่มีความสูงเท่ากัน
- `min-width: 0` ทุก cell/child; `max-width:100%`, `overflow:hidden` เฉพาะ cell หรือ chip ที่ยาว ห้ามซ่อน page-level overflow เพื่อแก้ปัญหาต้นเหตุ
- ไม่มีเส้นแบ่งช่องชัด ใช้ transparent/invisible separators หรือ hairline opacity น้อยกว่าเงารวมมาก ห้ามเส้นตารางทึบ
- วันที่มี event อาจมี pastel dots/chips; วันไม่มี event ไม่จำเป็นต้องมี dot
- **เฉพาะวันที่เป็นตัวหนา**; ชื่อกิจกรรมและ subtitle ของแต่ละวัน `font-weight: 400`
- ห้ามแสดงอักษร chip ข้ามไปใน cell ข้างเคียง (ภาพ mockup เคยมีปัญหา)
- หากกิจกรรมมากกว่าพื้นที่: แสดง 1–2 labels ที่สั้น + `+N` อย่างไม่รก; `N` ต้องคำนวณจากจำนวนจริงที่ถูกซ่อน
- หากชื่อยาวให้ใช้ `shortTitle` / `line-clamp: 1/2`, `text-overflow:ellipsis`; ไม่ปรับ width ของคอลัมน์เพื่อให้ข้อความครบ
- เดือน 4/5/6 สัปดาห์ต้องรองรับได้; เมื่อ 4 หรือ 5 แถว ไม่ยืดการ์ดให้มีพื้นที่ว่างมากเกินจำเป็น
- ไม่มี horizontal scroll และสามารถเลื่อน **แนวตั้ง** หาก 6 แถวไม่พอจอจริง

## 4.3 Behavior Requirement Matrix — Month

| ID | Action | Expected result |
|---|---|---|
| MON-01 | เข้า Month view | แสดงเดือนของ `selectedDate` ไม่รีเซ็ตวันเป็นวันที่ 1 |
| MON-02 | กดลูกศรซ้าย/ขวา | เลื่อนเดือน -/+ 1, คำนวณกริดวันที่ใหม่; กรณีวัน 31 ไปเดือนสั้น clamp เป็นวันสุดท้าย |
| MON-03 | แตะวันใดวันหนึ่ง | เปลี่ยน `selectedDate` + pink highlight; **ไม่เปิด agenda ด้านล่าง** และไม่สลับ Day เอง |
| MON-04 | แตะวันนอกเดือน | เลื่อนเดือนที่แสดงไปยังเดือนนั้นและเลือกวันที่กด |
| MON-05 | กด View picker → “รายวัน” | เปลี่ยนเป็น Day View ของ `selectedDate` นั้น เพื่ออ่านรายละเอียดทั้งหมดตามที่ผู้ใช้ต้องการ |
| MON-06 | รายการในวันเดียวมีมาก | แสดง chip ตามลำดับและ `+N` โดยไม่ล้น; ผู้อยากดูครบสลับ Day เอง |
| MON-07 | แตะ chip | เลือกวันที่ของ chip นั้นเท่านั้น (ผลเหมือนแตะวันที่); **ไม่เปิด preview/agenda**, ไม่เปลี่ยน view เอง; ผู้ใช้สลับเป็นรายวันด้วย view picker หากต้องการรายละเอียดครบ |
| MON-08 | Multi-day promotion | แสดงช่วงเวลาต่อเนื่องอย่างนุ่ม ไม่ทำ grid ยืด/เส้นแน่น; ดูต้น/ปลายและ ongoing ได้ |
| MON-09 | Today action | ถ้ามีตามบริบทเมนู ให้กลับเดือน+วันที่จริงปัจจุบัน; ไม่จำเป็นต้องเพิ่มปุ่มใหม่บน screenshot ที่ไม่ได้มี |
| MON-10 | Filtered events | filter ภายใน calendar shell โดยไม่สร้าง panel ใหม่ที่เบียดปฏิทิน; filter เก็บ state ได้ |
| MON-11 | Empty month | ยังคงกริดวันที่สะอาด ไม่มีการ์ด Empty ขนาดใหญ่แทรกในช่อง; แสดง empty hint อย่างไม่รบกวนถ้าจำเป็น |
| MON-12 | Week starts Monday | ตรวจตาม calendar library และ timezone Asia/Bangkok; วันจัดช่องถูกต้องทุกปี |
| MON-13 | Month changed | Calendar header และวันที่/จำนวนแถว update พร้อมกัน ไม่มี ghost event จากเดือนเก่า |
| MON-14 | Long press date (touch) | MVP **ไม่ทำ long-press action เพิ่ม** เพื่อลด behavior ที่ไม่ได้ปรากฏใน master; ผู้ใช้เลือกวันที่แล้วสลับ “รายวัน” และกด FAB + เมื่อต้องการสร้างรายการ |
| MON-15 | ไม่มี FAB ใน Month reference | ห้ามเติม FAB เด่นโดยพลการ; สามารถสร้างจาก Day FAB หรือ entrypoint ที่มีอยู่ใน nav/เมนูเท่านั้น |

## 4.4 นโยบายการแสดง Event Short Labels

| Type | Hue | ตัวอย่าง short label | เงื่อนไข |
|---|---|---|---|
| promotion | pastel pink | `โปร Off-Peak`, `เริ่มโปรใหม่` | ถ้าเป็นโปรหลายวัน แสดง start/active/end ตาม spec |
| content | pale cyan | `ถ่ายคอนเทนต์` | ใช้ชื่อที่กระชับ 1 บรรทัด |
| appointment | light lavender/pink | `ประชุมการตลาด` | สีรองไม่เข้ม |
| inventory | pale green | `เช็กสต็อก`, `สั่งน้ำเพิ่ม` | ลดความยาวข้อความ |
| event | light lavender/green | `แข่งขัน`, `กิจกรรม` | แยกจากการจองปกติ |
| holiday | subtle neutral/pastel | `วันหยุด` | ข้อมูลวันหยุดต้องมาจาก calendar data source ที่เชื่อถือได้หรือ admin กำหนด |

**Monthly event visibility:** ทุก event ต้องมี `shortTitle` ที่เจ้าหน้าที่แก้ได้ (กำหนดขนาดสูงสุดที่เหมาะกับจอจริง); ถ้าไม่มี ให้ใช้ชื่อที่จัดรูปแบบจากต้นทางแบบ grapheme-aware ไม่ตัดอักษรไทยกลางสระ/วรรณยุกต์. Sort: (1) วันเริ่มโปร/Deadline สำคัญ (2) งานที่มีเวลา (3) อื่น ๆ แล้วตาม `startAt` และ `priority`; สามารถ reorder ได้เฉพาะในระบบของเรา

## 4.5 Multi-day promotion / ระยะโปรโมชั่นข้ามวัน

ตัวอย่างโปรโมชั่นลูกค้าใหม่ **6–10 พ.ย.** จะต้องมี `startAt` และ `endAt` จริงเพียงรายการเดียว แต่ render ใน Month ทุกวันที่ครอบคลุมช่วงนั้น โดยเลือก pattern ตามความหนาแน่น:

- Desktop/Tablet: thin continuous pastel ribbon spanning consecutive cells ในสัปดาห์เดียว และแตกชิ้นเมื่อข้ามสัปดาห์
- iPhone: light tint หรือข้อความ short chip ขนาดเหมาะสมในวันที่เริ่ม และ dot/soft continuation ในวันถัดไป; กรณีพื้นที่ไม่พอให้ใช้ `+N` ไม่ทำให้ตัวหนังสือล้น
- ต้องมี accessible label เช่น `โปรโมชั่นลูกค้าใหม่ 6 ถึง 10 พฤศจิกายน` ไม่ใช่แค่สี
- ระบุ start/end milestones ใน Day View เมื่อเข้าสู่วันที่เริ่ม/สิ้นสุด
- ไม่คำนวณวันที่สิ้นสุดผิดเมื่อโปรโมชั่นกำหนดจบ 23:59 หรือเป็น all-day: ใช้ exclusive-end convention ภายในให้ชัด

---

# 5. BUSINESS DATA / โมดูลที่เติมกิจกรรมลง Calendar

## 5.1 Source of Truth ต่อประเภทงาน

| Module | ตัวอย่างที่โชว์ | ใครแก้ต้นทาง | การเปลี่ยนแปลงที่ปฏิทินต้องสะท้อน |
|---|---|---|---|
| Promotion | ช่วงเริ่ม-สิ้นสุดโปร, วันส่งอนุมัติ | Promotion module | เปลี่ยนวัน/สถานะ → update ใน calendar ใน transaction/outbox |
| Campaign / Ads | ระยะเวลาแคมเปญ, วัน Review ผล | Campaign module | เปลี่ยนแผน → calendar sync |
| Content | ถ่ายทำ, ส่งตรวจ, วันโพสต์, วันเผยแพร่ | Content module | status/date เปลี่ยน → update |
| Manual appointment | ประชุม, นัดส่วนตัว, นัดพาร์ตเนอร์ | Calendar owner | CRUD จาก calendar ได้โดยตรง |
| Task / Approval | Deadline / งานรออนุมัติ | Tasks module | ตั้งเสร็จ/เปลี่ยนวัน → update |
| Inventory | ตรวจนับ/เติมตู้ | Inventory module | วันตรวจนับเปลี่ยน → update |
| Purchase Order | วันสั่ง/ETA วันรับสินค้า | Purchasing module | รับของแล้ว → status completed |
| CRM | Follow-up ที่ได้รับอนุญาต | CRM module | เฉพาะผู้มีสิทธิ์เห็นรายการ |
| Venue Activity | Tournament/Workshop | Event module หรือ manual | เป็นกิจกรรมการตลาด ไม่ใช่รายการจองสนามทั้งหมด |
| Holiday | วันหยุด/เทศกาล | Cal Feed/Admin | แสดงตามวัน/ประเทศที่ตั้งค่า, ไม่แก้แหล่ง feed ต้นทาง |

หากบริษัทไม่อนุญาตเชื่อมเว็บไซต์จองสนาม ปฏิทิน **ยังใช้ได้เต็มรูปแบบ** ผ่าน Manual + โมดูลของเรา + Import CSV ที่ได้รับอนุญาต. ไม่มีการไปแก้ Booking/LINE server บริษัท

## 5.2 ป้องกันข้อมูลซ้ำ/สองทาง

- ข้อมูลที่สร้างใน `Calendar` โดยตรง: `sourceModule=manual`, Calendar owns all editable fields
- ข้อมูลจาก module อื่น: `sourceModule`, `sourceId`, `sourceVersion`, `sourceUpdatedAt` และ `calendarEventKey=sourceModule:sourceId:milestoneType`
- Upsert ตาม composite unique key; ห้าม append รายการใหม่ทุกครั้งที่ synchronize
- เมื่อ source ถูกยกเลิก/ลบ: ปฏิทินเปลี่ยนสถานะหรือซ่อนตาม policy แต่ยังมี audit record
- ไม่ให้แก้ `source start/end/status` ใน Calendar โดยตรง; ใช้ deep link ไปเจ้าของข้อมูล หรือ workflow request change ที่ชัดเจน
- Scheduled Import ล้มเหลว: เก็บข้อมูลล่าสุดพร้อม timestamp และ warning ไม่ล้างปฏิทินเดิม
- Manual event จากคนละทีมที่ชื่อซ้ำต้องไม่ dedupe กันจากข้อความอย่างเดียว ต้องใช้ ID ต้นทาง

## 5.3 Event data shape ที่ Dev ต้องรองรับ

```
CalendarEvent {
  id: UUID,
  sourceModule: 'manual'|'promotion'|'campaign'|'content'|'task'|'inventory'|'purchase_order'|'crm'|'event'|'holiday',
  sourceId?: string,
  milestoneType?: string,             // promo_start, promo_end, publish, delivery, meeting ...
  title: string,
  shortTitle?: string,                // สำหรับ Month chips
  description?: string,
  category: string,
  status: 'planned'|'in_progress'|'pending_approval'|'approved'|'completed'|'cancelled',
  startAt: ISO8601_with_offset,
  endAt: ISO8601_with_offset,
  allDay: boolean,
  timeZone: 'Asia/Bangkok',
  recurrenceRule?: string,            // เช่น RRULE ในรูปมาตรฐาน
  excludedDates?: string[],
  ownerId: UUID,
  attendeeIds?: UUID[],
  visibility: 'private'|'team'|'management',
  teamId?: UUID,
  priority?: 'low'|'normal'|'high',
  colorKey?: 'promotion'|'content'|'appointment'|'inventory'|'event'|'holiday',
  locationText?: string,
  sourceUrl?: string,                  // whitelist internal link or validated external URL
  reminders?: Reminder[],
  attachments?: AttachmentRef[],
  origin: 'manual'|'import'|'internal_sync'|'approved_api',
  verification: 'verified'|'unverified'|'not_applicable',
  createdAt, updatedAt, createdBy, updatedBy,
  sourceUpdatedAt?: string,
  version: integer,
  isDeleted: boolean
}
```

**Date storage:** Stored in UTC/offset-aware `timestamptz`; date-only all-day events should use local date with exclusive end; frontend Thai Buddhist year only display format, database never stores 2569 as Gregorian year. `startAt < endAt` for timed event, except explicit zero-duration milestone type

## 5.4 Data views / API contracts (suggestion, not mandate on current stack)

- `GET /api/calendar/events?from=2026-11-01&to=2026-12-01&types=...&mine=true` → bounded range and paginated metadata
- `GET /api/calendar/events/:id` → detail with permission checks
- `POST /api/calendar/events` → manual event create (idempotency key / CSRF appropriate)
- `PATCH /api/calendar/events/:id` → authorized manual updates with optimistic concurrency/version
- `DELETE /api/calendar/events/:id` → soft-delete/cancel with audit
- `GET /api/calendar/filters` → enum, user role, visible categories, available teams
- `GET /api/calendar/notifications` → reminders (if provided by existing notification system, reuse it)
- `POST /api/calendar/reminders` or job queue → schedule; no uncontrolled duplicated notifications

**Permissions enforced on server** for list, detail and mutations; frontend hiding is insufficient. API calls must never send all customers' contacts or LINE message history to calendar UI merely to display attendee counts

---

# 6. NEW / EDIT / VIEW FLOW — ขั้นตอนทำงานครบ

## 6.1 Create manual event — Day FAB

1. User อยู่ Day View เลือกวันที่ 4 พ.ย. → กด `+`
2. เปิด Bottom Sheet บนมือถือ (หรือ centered Dialog/Side Sheet บน Desktop) ที่เลื่อนฟอร์มได้ ไม่ทำ background page scroll
3. Header ชื่อ “เพิ่มรายการ” และ X/Back; ใช้ Card/Opacity/Shadow แบบ Master
4. เลือกประเภท: นัดหมาย / งานทั่วไป / กิจกรรม / คอนเทนต์ / สต็อก (รายการที่เป็นโปรโมชั่นจริงต้อง redirect ไป Promotion Builder ตาม rule)
5. กรอก `title` required; `shortTitle` optional; `description` optional
6. เลือกวันที่เริ่มและสิ้นสุด **คนละบรรทัดบนมือถือ**; เลือกเวลาเริ่ม/สิ้นสุดคนละบรรทัด (native iOS picker)
7. สวิตช์ `ทั้งวัน`, `ทำซ้ำ`, `แจ้งเตือน`, `ความเป็นส่วนตัว`
8. เพิ่มผู้รับผิดชอบ/ผู้เข้าร่วมเฉพาะผู้ใช้ที่มีสิทธิ์, แนบไฟล์/ลิงก์เฉพาะที่จำเป็น
9. Validation ใกล้ field; `end >= start`, required values; error ไม่ทำค่าที่กรอกหาย
10. กด `บันทึก` เพียงครั้งเดียว (double-submit guard) → persist DB → update Day + Month ทันที → success toast (ไม่ปิดจนบันทึกสำเร็จ)
11. หากล้มเหลว: แสดง error ที่อ่านเข้าใจและ Retry โดยไม่ล้างฟอร์ม
12. กลับมา Day date ที่สร้าง; ข้อมูลยังอยู่หลัง Refresh/Logout/Login ตามสิทธิ์

## 6.2 Edit / cancel

- เปิด Event Detail → `แก้ไข` เฉพาะ event ที่มีสิทธิ์
- สำหรับ `sourceModule=manual`: เปิดฟอร์มเดิมพร้อมข้อมูลจริง; optimistic lock; บันทึก change audit
- สำหรับ derived event: ปุ่มไปยังหน้าเจ้าของข้อมูล เช่น Promotion หรือ Content; ไม่แก้ data สองระบบแยกกัน
- ยกเลิกมี confirmation ไม่ใช่ลบทันที; โดยปกติ soft delete/status cancelled; จำนวนซ้ำต้อง recalculated
- เมื่อตั้ง recurring: ถาม `เฉพาะครั้งนี้ / ครั้งนี้และครั้งถัดไป / ทั้งชุด` และป้องกันการแก้แบบทำรายการทั้งชุดหาย

## 6.3 View switch and selected date continuity

`selectedDate` เป็น local date object/string `YYYY-MM-DD` (Gregorian) และ `view=day|month` แยกจากกัน

- Day → Month: selectedDate เดิม, month cursor = month ของ selectedDate
- Month → Day: selectedDate เดิม, timeline สำหรับวันนั้น
- Month กดซ้าย/ขวา: month cursor เปลี่ยน; selectedDate ต้องอยู่ในเดือนที่แสดงและ clamp วันที่ 31/30/28/29 ให้ถูกต้อง; ไม่กระโดดโดยไม่มี feedback
- Month แตะ 17 พ.ย. → pink selection วัน 17; กด “รายวัน” → Day 17 พ.ย.
- Day แตะ 4 พ.ย. แล้วดู Week strip → View Month ต้องเลือกวันที่ 4 แม้ Month อยู่หน้าหรือกลับจาก back
- URL state เป็นตัวนำทาง; back/forward ใช้งานได้. หากต้องการเก็บ lastView ใน local/session storage ให้เป็น preference เท่านั้น ไม่ทับ deep link

## 6.4 Filter workflow

- Categories: Promotion, Campaign, Content, Appointment, Task, Inventory, Event, Holiday
- Filter owner: Mine / Team / All visible
- Filter status: Planned, Pending Approval, Active/In Progress, Completed, Cancelled
- ถ้า filter ไม่ตรงวันหรือไม่มีข้อมูล ก็แสดง calendar เปล่า ไม่เปลี่ยน size grid หรือซ่อนวันที่
- UI filter ในภาพ 2 หน้าไม่มีแผงใหญ่ จึงวางเป็น overflow popover/bottom sheet ผ่านปุ่มที่สอดคล้องกับ design เดิม; **อย่ายัด filter bar ใหม่เหนือ Month Grid บน iPhone**
- Save preference per user; แสดง dot/chip เฉพาะ filtered events แต่ไม่ลด category count ผิด

## 6.5 Reminder / notification

- ตั้งเตือนได้ เช่น 5, 15, 30, 60 นาที, 1 วันก่อน; default ตามประเภทงาน
- แจ้งเตือนรายการกำลังถึงกำหนด/เลยกำหนดเฉพาะ Task, นัดหมาย, สิ้นสุดโปร, วันรับของ
- หาก browser ไม่อนุญาต Push ให้มี **in-app notification** เมื่อเปิดระบบ และไม่กล่าวอ้างว่าส่ง Push ได้
- ป้องกัน repeated/duplicate notification ตาม `(eventId, reminderId, occurrenceDate, recipient)`
- ประเภทที่เป็นข้อมูลส่วนบุคคลไม่เปิดรายละเอียดใน notification ของผู้ไม่มีสิทธิ์

---

# 7. RESPONSIVE & iPHONE INPUT CONTRACT

## 7.1 Viewports ที่ต้องตรวจ

| Device QA | CSS viewport ที่ใช้ทดสอบ | Layout requirement |
|---|---|---|
| Small iPhone | 375×812 | ห้าม overflow; Month 7 columns เท่ากัน; text readable |
| iPhone 13/14 reference | 390×844 | Core mobile target |
| iPhone 15 Pro reference | 393×852 | Core mobile target |
| Large iPhone | 430×932 | Content ไม่ยืดจนมีช่องว่างเกิน |
| Small tablet | 768×1024 | ปฏิทินอ่านได้; nav ปรับแบบ tablet |
| iPad | 820×1180 | ใช้พื้นที่เหมาะสม; grid ไม่แคบเกิน |
| iPad Landscape | 1024×768 | Calendar ยืดตามพื้นที่; scroll ได้ |
| Desktop | 1440×900 | Sidebar desktop แบบเดิมถ้ามี; content width สมเหตุสมผล |
| Wide desktop | 1920×1080 | ไม่ยืดการ์ด/ระยะจนห่างเกิน; use max-width |

**สำคัญ:** Reference PNG เป็นภาพ mockup ขนาด **940×1672 px** ไม่ใช่ CSS viewport ของ iPhone จริง ให้ถือเป็น Visual Master ไม่ใช่ข้อกำหนดการฝืนยัดทุกแถวให้อยู่เหนือ fold เมื่อเปิดบน iPhone 393×852. เมื่อ 6 แถว Month ทำให้สูงเกินจอ **ต้อง scroll แนวตั้งได้** ไม่ใช่ลดตัวอักษรจนเล็กหรือซ่อนกิจกรรม

## 7.2 Touch and iPhone input

- Touch target ปุ่มหลักอย่างน้อย ~44×44 CSS px; interactivity ครอบคลุมทั้งวัน ไม่ต้องจิ้มตัวเลขเล็ก ๆ
- `input`, `textarea`, `select` font-size **16px ขึ้นไป** เพื่อป้องกัน iOS Safari input zoom; ห้ามแก้ด้วย `user-scalable=no` หรือ `maximum-scale=1`
- Date/time picker ใช้ native `<input type="date">` และ `<input type="time">` หรือ native overlay ที่ได้รับการทดสอบบน Safari/LINE; **ห้าม `appearance:none` กับ native input โดยตรง** จนค่าหรือ icon หาย
- วัน/เวลาบนมือถือเรียงเต็มบรรทัด `width:100%; max-width:100%; min-width:0`; ไม่จัดวันที่กับเวลาหลายคอลัมน์ที่แคบจนล้น
- ถ้า iOS native control ขยายความกว้างให้ใช้ custom display wrapper + transparent native input ที่คลุมกรอบจริง โดยต้องยังเรียก native picker ได้
- ใช้ safe-area `env(safe-area-inset-bottom)` กับ sticky bottom nav และ FAB; keyboard เปิดแล้ว focus field มองเห็น; fixed nav ต้องไม่บัง form
- ไม่ใช้ `overflow-x:hidden` ที่ `body` เพื่อปกปิด element ที่ล้นจริง; แก้ min-width/overflow ของ component
- Overlay/Sheet ต้องปิดเมื่อกด Escape/backdrop ตามประเภทและไม่ทำข้อมูลสูญหายโดยไม่เตือน

## 7.3 Responsive Calendar details

**Mobile (375–430 CSS px)**
- Day: Week strip = 7 columns; timeline single column; FAB (เฉพาะ Day) + sticky bottom nav
- Month: 7 equal cols, labels 1–2 short per cell, no bottom list; scroll vertical allowed
- Padding screen ~12–18px และ card padding ปรับตามภาพ/จอ; ความกว้างทุก child `min-width:0`
- หาก chip ยาวเกิน ใช้ shortTitle/clamp และ `+N`; ไม่บังคับให้ card ยื่นออกไป

**Tablet**
- แสดง 7 cols month กว้างขึ้น มีรายละเอียดเพิ่มตามพื้นที่; Day Timeline กว้างขึ้นโดยไม่เพิ่ม panel ใหม่ถ้าไม่ได้จำเป็น
- Bottom nav อาจปรับเป็น sidebar icon rail เฉพาะเมื่อเข้ากับ Design System เดิม; ห้ามเปลี่ยนสี/รูปร่าง

**Desktop**
- ใช้ Sidebar ไอคอนวงกลมเดิมของ Wonder Courts และ header เดิมที่มีอยู่ โดยไม่สร้างเว็บ layout ใหม่
- Month grid 7 cols พร้อม labels ได้มากขึ้น; ไม่เพิ่ม Agenda panel ถ้า user ไม่สั่ง
- Day view เป็น timeline ใน main content; detail panel เปิดเมื่อกด event ได้

---

# 8. ACCESSIBILITY, CONTENT, PERFORMANCE

### 8.1 A11y
- ระบุ `aria-label` สำหรับวัน เช่น “วันพุธที่ 4 พฤศจิกายน 2569, 3 กิจกรรม” และปุ่มลูกศรเดือน
- Date cell เป็น button/interactive element ที่ Tab และ Enter/Space ได้; selected date มี `aria-selected`
- View switcher เป็น button ที่แสดง `aria-expanded`, `aria-controls` และรายการเลือกที่ใช้ keyboard ได้
- ห้ามใช้ **สีอย่างเดียว** สื่อประเภทงาน; ต้องมี text/icon/accessible label
- คำอธิบายอาจเล็กกว่า title แต่ไม่ควรต่ำกว่า 12px ใน Month chips บนมือถือ ถ้าพื้นที่ไม่พอใช้ truncation
- Visible focus, screen-reader usable, Reduced Motion, contrast ตัวหนังสือสำคัญ
- ผู้ใช้ที่ตั้ง font scale เพิ่มต้องเลื่อนหน้าได้ ไม่ซ้อน/ตัดข้อความสำคัญ

### 8.2 Date correctness
- `Intl.DateTimeFormat('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok' })` หรือ wrapper ที่ทดสอบ; อย่าบวก 543 แบบสุ่มหลายจุด
- แสดง weekday ให้ตรง date จริง; Nov 4 2026 = Wednesday (วันพุธ)
- 29 Feb leap year, cross-year, month 28/29/30/31, DST of imported external zones (แปลงสู่ Asia/Bangkok), midnight-boundary
- Sorting timed events by `startAt`, then stable ID, all-day first; time `09:00 น.` 24h
- Recurrences ต้องคำนวณ occurrence ในช่วง query อย่างมีขีดจำกัด ห้ามสร้าง record ไม่มีที่สิ้นสุด

### 8.3 Performance/Resilience
- Load Day/Month ในช่วงวันที่ต้องใช้เท่านั้น; prefetch เดือนก่อน/หลังแบบ sensible
- Skeleton card คง layout ไม่ทำ CLS; error state มี Retry
- Large dataset: event virtualization/grouping ใน Day; month payload bounded 1 month + spillover days
- Scroll/tap smooth บนโทรศัพท์ระดับกลาง; ไม่ re-render ทั้งเดือนทุกครั้งที่กด checkbox unrelated
- Offline: ดูข้อมูล cache ล่าสุดถ้าอนุญาต/เหมาะสม พร้อมป้าย `ข้อมูลล่าสุดเมื่อ…`; ห้ามให้บันทึกสำเร็จปลอม
- Log API errors และ import source freshness โดยไม่ log ข้อมูลส่วนบุคคลเกินจำเป็น

---

# 9. SECURITY & PERMISSIONS

| Role | See | Create/Edit | Special controls |
|---|---|---|---|
| Admin | รายการทุกทีมตามสิทธิ์องค์กร | แก้ manual + ตั้ง permission | ดู audit, ไม่แก้ข้อมูล source โดยข้ามโมดูล |
| Management | รายการทีม/รายงานที่ได้รับสิทธิ์ | อนุมัติสิ่งที่ได้รับมอบหมาย, เพิ่มนัดของตน | ไม่ขยายสิทธิ์ด้วย UI |
| Marketing | Promo/Content/Campaign/Tasks ที่รับผิดชอบ | สร้างและจัดการตาม role; ขออนุมัติ | เห็น customer follow-up เฉพาะที่อนุญาต |
| Inventory | Stock/Purchase/Tasks ที่เกี่ยวข้อง | จัดการตามสิทธิ์ | ไม่เห็นข้อมูล CRM ที่ไม่จำเป็น |
| Viewer | เฉพาะรายการ public/team | ไม่มีสิทธิ์แก้ | API ต้อง reject writes |

- `visibility=private` เห็นเฉพาะเจ้าของ/ผู้ได้รับสิทธิ์; Management ไม่ได้เห็น private โดยอัตโนมัติทุกคน
- Server-side authorization ทุก endpoint, row-level filtering ตาม tenant/team/owner
- Audit create/update/delete/approve (who, when, before/after)
- URL import source restricted; protect against malicious CSV formula injection for exports, XSS in descriptions, unsafe attachments
- Personal data minimization: avatars/ชื่อจริงเป็นข้อมูลต้องได้รับอนุญาต; ไม่ใส่รูปบุคคลจาก mockup ในระบบจริง

---

# 10. STATES / ERROR / EDGE CASES

| State | Day | Month | Requirement |
|---|---|---|---|
| First load | timeline skeleton | grid skeleton | glow/white soft, ไม่กระพริบ |
| No events | empty message in content | clean date grid | Month ไม่มีรายการสรุปใต้ grid |
| Filter yields none | blank timeline / clear filter CTA | blank grid + selected date | อย่าล้าง filter โดยไม่บอก |
| API timeout | last cache/Retry warning | last cache/Retry warning | ห้ามแสดง old data เป็น real-time |
| Save failure | form stays open | unchanged event | typed values preserved |
| Permission denied | safe message | hide unauthorized chips | ห้าม leak title ผ่าน count |
| Event deleted while open | close or show expired message | remove after refresh | no stale write |
| Source sync delayed | subtle freshness label detail | no fake chip status | ไม่อ้าง active หากยัง pending confirmation |
| Same time overlap | chronological cards + conflict warning | normal short labels | month cells same size |
| 0 duration | milestone if explicit | one-day date mark | other negative durations invalid |
| Very long Thai title | card wraps naturally | grapheme-safe truncation | no overflow |
| Multiple categories in a day | multicolor labels | one/two +N | accessible combined label |
| 6-row month on small iPhone | scroll vertically | scroll vertically | nav never overlaps |
| Image/avatar unavailable | icon/initial fallback | no issue | no broken image boxes |

---

# 11. RCM — REQUIREMENT TRACEABILITY / ACCEPTANCE MATRIX

Severity definitions: **P0** = ห้ามเปิดใช้งานหากไม่ผ่าน; **P1** = ต้องผ่านก่อนสรุปงานชุดนี้; **P2** = nice to have ที่ไม่เปลี่ยน UI ที่อนุมัติ

| Requirement ID | Priority | Source/Decision | Test ID |
|---|---|---|---|
| RCM-V01: Day/Month match approved images | P0 | User master screenshots | VIS-01, VIS-02 |
| RCM-V02: White-blue bright translucent cards & soft shadow | P0 | Explicit user repeated instruction | VIS-03 |
| RCM-V03: No distinct month grid borders | P0 | Explicit user | VIS-04 |
| RCM-V04: Month event labels regular weight, dates bold | P0 | Explicit user | VIS-05 |
| RCM-V05: Equal width 7 cols and equal row height | P0 | Explicit user | VIS-06 |
| RCM-V06: Month has NO bottom agenda list | P0 | Explicit user | VIS-07 |
| RCM-F01: Day/Month mode switch preserves date | P0 | Flow | FUNC-01 |
| RCM-F02: Month tap date highlights only | P0 | User wants details in Day | FUNC-02 |
| RCM-F03: Timeline time-sort and event details | P0 | Day screenshot | FUNC-03 |
| RCM-F04: Create/Edit/Delete manual event persisted | P0 | Core system | FUNC-04 |
| RCM-F05: Promotion/content/stock source changes reflected | P0 | Master Calendar | FUNC-05 |
| RCM-F06: No change to company booking/LINE backend | P0 | Scope safety | SEC-01 |
| RCM-F07: RBAC server checks | P0 | Security | SEC-02 |
| RCM-F08: Correct Thai Buddhist calendar weekdays | P0 | Data quality | FUNC-06 |
| RCM-F09: iPhone Safari, native input, no zoom or overflow | P0 | Mobile rules | MOB-01 |
| RCM-F10: Bottom nav safe area / keyboard | P0 | Mobile rules | MOB-02 |
| RCM-F11: No duplicate imported/source events | P0 | Data rule | DATA-01 |
| RCM-F12: Empty/Error/Loading/Retry | P1 | UX | FUNC-07 |
| RCM-F13: Reminders permission aware | P1 | UX | FUNC-08 |
| RCM-F14: Multi-day promos across weeks | P1 | Marketing requirement | FUNC-09 |
| RCM-F15: Accessibility keyboard/screenreader | P1 | Accessibility | A11Y-01 |
| RCM-F16: Theme consistent iPad/PC | P1 | Responsive | VIS-08 |
| RCM-F17: No invented actual data | P0 | Data integrity | DATA-02 |

---

# 12. DEV IMPLEMENTATION PLAN / PHASE GATES

### Gate A — Inspect existing codebase (required)
- Inspect Repo, main branch, current production, UI assets, routing, auth, DB schema, existing Calendar APIs and component library
- Use existing project only; `fetch origin main`, create feature branch, resolve conflicts safely
- Write affected scope and no-change scope; ensure no alternate repo/project/url

### Gate B — Design tokens + static responsive shell
- Implement CSS gradient/glow + glass cards as real components, not screenshots as backgrounds
- Build shared header, view selector, bottom nav, selected date state
- Render from fixture JSON with correct Thai weekday/year
- Screenshot comparison on iPhone 393×852 and 390×844; obtain user sign-off before building 30 unrelated pages

### Gate C — Interactive calendar (real UX)
- Day week strip / chronological timeline / event detail / FAB new event
- Month navigation / 7 equal columns / fixed equal rows / chips +N / no bottom agenda
- Switchover URL state + browser Back
- Full UI test on 375/390/393/430 and iPad/PC

### Gate D — Persistence + permissions
- Wire API/DB/Auth/RBAC/Audit; create/update/delete and recurring event rules
- Derived module event sync, idempotent upserts, source deep links, errors
- Add notifications on eligible events where system supports

### Gate E — Release / Definition of Done
- Automated tests + manual QA Safari iPhone/LINE browser/Android/iPad/Desktop
- On staging, compare Day and Month screenshots against both masters, fix visual drift
- Merge and deploy production **only after** QA and required authorization
- Check actual production URL, test interactions end-to-end, report branch/commit/URL/test evidence
- Never report done if only mock, preview or nondeployed code

---

# 13. QA SCENARIOS (Gherkin quick examples)

**Scenario 1: Month to Day**  
Given Month Nov 2026 and selected date 4 Nov  
When user chooses `รายวัน`  
Then route shows Day Nov 4, timeline contains that day’s events, selection remains 4

**Scenario 2: No bottom agenda**  
Given Month Nov 2026  
When user taps a date  
Then only its date highlight changes, and no agenda list is inserted beneath month grid

**Scenario 3: Long title**  
Given a 40-character Thai event title on Nov 4  
When Month renders at 375px viewport  
Then 7 columns remain equal, label uses shortTitle/clamp/+N, no chip/text spills into adjacent dates

**Scenario 4: No strong borders**  
Given Month renders 6 weeks  
Then background remains airy white and cell borders do not form dark or prominent lattice lines

**Scenario 5: Real date calculation**  
Given `2026-11-04` Asia/Bangkok  
Then weekday label is `พ.`/`วันพุธ`, and month is `พฤศจิกายน 2569`

**Scenario 6: Data stays after refresh**  
Given a manual appointment is saved successfully  
When browser is refreshed and user signs in again  
Then Day and Month show exactly one event with the saved fields

**Scenario 7: Source edit**  
Given content item `CONT-101` is scheduled for Nov 4  
When Content module changes publish date to Nov 6  
Then Calendar shows it on Nov 6 only, without a duplicate leftover on Nov 4

**Scenario 8: Protected event**  
Given a private follow-up belongs to User A  
When User B requests calendar events via API  
Then response does not include the event ID/title/count revealing the record

Full test matrix and exact acceptance checklist are in `qa/CALENDAR_ACCEPTANCE_TESTS.md`.

---

# 14. DESIGN REVIEW CHECKLIST (ผู้ใช้งานตรวจได้ด้วยตา)

- [ ] สี **ขาว-ฟ้าอ่อนโปร่งสว่าง** เหมือนภาพ master ไม่กลายเป็นเทาหรือชมพูเต็มจอ
- [ ] การ์ดมี white-translucent/frosted effect และเงาฟุ้งนุ่ม ไม่เป็นกรอบ/เงาคม
- [ ] โลโก้, header, avatars, pill view picker และ bottom nav อยู่ตำแหน่งตามภาพ
- [ ] Day Week strip, timeline marker, selected meeting card และ FAB ตามภาพ
- [ ] Month ตัวเลขวันที่เด่น รายละเอียดเป็น font-weight 400 ไม่ Bold
- [ ] Month กริด 7 ช่องกว้างเท่ากัน ทุกสัปดาห์สูงเท่ากัน
- [ ] Month ไม่มีเส้นตารางหนา และไม่มีรายการแยกด้านล่าง
- [ ] Date selection ชมพูจางเฉพาะจุด, event categories เป็น pastel chips ไม่รก
- [ ] ไม่มี chip ล้นช่อง ข้อมูลทับกัน การ์ดสูงผิดจังหวะ หรือ horizontal scroll
- [ ] 393×852 / 390×844 / 375×812 ใช้งานได้จริง; vertical scroll ได้; dock ไม่บัง
- [ ] ชื่อวันตรงปฏิทินจริง และ format Thai Buddhist year ถูกต้อง
- [ ] เปลี่ยน Day ↔ Month โดยไม่ลืมวันที่เลือกและไม่มีข้อมูลหาย
- [ ] เพิ่ม/แก้/ยกเลิกนัดหมายแล้ว DB บันทึกจริงและกริดอัปเดต
- [ ] ระบบเดิมของบริษัทไม่ถูกแตะ/แก้/ตัดการเชื่อมต่อ
- [ ] มี test screenshot comparison ของ **ทั้งสองหน้าแยกไฟล์** พร้อมหลักฐานใน staging/production

---

# 15. SIGN-OFF & HANDOFF RULE

**Approval protocol:** ต้องให้ผู้ใช้อนุมัติภาพจริงของ **Day และ Month บน iPhone** ที่ถ่ายจากหน้าเว็บ/Browser ในขนาดจริงก่อนขยายการแก้ UI ไปโมดูลอื่น. Screenshot mockup ที่วาดจากภาพไม่ถือเป็น acceptance evidence ของโค้ด

**When visuals do not exactly match:** แก้ CSS tokens/shadows/blur/layout component แล้ว screenshot เปรียบเทียบใหม่ ห้ามส่งภาพ generation ใหม่ที่ดูคล้ายแล้วอ้างว่า code ผ่าน. ถ้ายังมี limitation ที่ห้ามใช้ native browser หรือ font rendering เดิม ให้ระบุความแตกต่างเป็นรายการชัดและขอผู้ใช้อธิบายเฉพาะจุดนั้น ไม่เปลี่ยนธีมเอง

**Definition of Done:** Two functional views + persistent authorized data + navigation + responsive QA + pixel/visual review + production deploy/check. ต้องระบุชัดว่าอะไรเป็น Real, Imported, Manually Entered, Demo และ Not Connected.

---

## Appendix: Candidate UI hierarchy

```text
CalendarShell
├── HeaderBrandProfile
├── DateHeadingAndViewSwitcher
├── DayView
│   ├── SevenDayWeekStrip
│   ├── Timeline
│   │   └── DayEventCard[]
│   ├── EventDetailSheet
│   └── CreateEventFAB
├── MonthView
│   ├── MonthNavigation
│   ├── WeekdayHeader
│   └── SixOrFewerWeekRows
│       └── DayCell[7] -> DateNumber + ShortEventChip(s) + MoreCount
├── SharedEventFormSheet
├── NotificationPopover
└── StickyBottomNav
```

**หมายเหตุ:** นี่เป็น component sketch สำหรับแยกความรับผิดชอบ ไม่ใช่ข้อกำหนดให้เปลี่ยน framework เดิม. Dev ต้อง reuse component library/runtime ของ Repo เดิมถ้ามี
