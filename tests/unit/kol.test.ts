import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITIONS, canTransition, APPLICANT_STATUSES, BUCKET_STATUSES, creditSummary, deliverableProgress, applicantRef, meetsFollowerRule,
  suggestPromoCode, isPromoCode, registrationMessage, initials, compactNumber, parseBucket, parseCeoTab, STATUS_LABEL, PUBLIC_STATUS, ceoCardMessage, refFromQuery, socialHandle, decisionNote, INFO_REASONS, REJECT_REASONS,
} from "../../lib/kol-core.ts";

test("marketing can never produce an approval; only the CEO decides pending cards", () => {
  for (const [key, t] of Object.entries(TRANSITIONS)) {
    if (t.to === "approved") assert.equal(t.by, "ceo", key);
    if (t.by === "ceo") assert.deepEqual(t.from, ["pending_ceo"], key);
  }
  assert.ok(!canTransition("reject_screening", "approved"));
  assert.ok(!canTransition("reject_screening", "pending_ceo")); // marketing cannot reject while the CEO is deciding
  assert.ok(!canTransition("send_to_ceo", "approved"));
  assert.ok(!canTransition("ceo_approve", "approved")); // no second approval
  assert.ok(canTransition("send_to_ceo", "ceo_info_requested")); // re-submit after the CEO asked for more info
  assert.ok(!canTransition("register", "pending_ceo")); // STEP 2 only after approval
});

test("every status has an internal label, a public label and belongs to 'all'", () => {
  for (const s of APPLICANT_STATUSES) {
    assert.ok(STATUS_LABEL[s] && PUBLIC_STATUS[s].title);
    assert.ok(BUCKET_STATUSES.all.includes(s));
  }
  assert.equal(parseBucket("nope"), "all");
  assert.equal(parseCeoTab("approved"), "approved");
  assert.equal(parseCeoTab(undefined), "pending");
});

test("court credit: entitlement, used and remaining are separate numbers", () => {
  const s = creditSummary([
    { kind: "entitlement", hours: 10, valueSatang: 600_000 },
    { kind: "usage", hours: 2, valueSatang: 0 },
    { kind: "usage", hours: 1.5, valueSatang: 0 },
    { kind: "adjustment", hours: -1, valueSatang: 0 },
  ]);
  assert.deepEqual(s, { entitled: 9, used: 3.5, remaining: 5.5, entitledValueSatang: 600_000 });
});

test("deliverable progress and follower rule", () => {
  assert.deepEqual(deliverableProgress([{ status: "verified" }, { status: "submitted" }, { status: "not_started" }]), { total: 3, verified: 1, submitted: 2, done: false });
  assert.equal(deliverableProgress([{ status: "verified" }]).done, true);
  assert.ok(meetsFollowerRule([{ followers: 1500 }, { followers: 2000 }], 2000));
  assert.ok(!meetsFollowerRule([{ followers: 1999 }, { followers: null }], 2000));
});

test("labels and generated text", () => {
  assert.equal(applicantRef(7), "KOL-0007");
  assert.equal(suggestPromoCode("Somjai Fit!", 3000), "SOMJAIFIT30");
  assert.equal(suggestPromoCode("สมใจ", 3000), "KOL30");
  assert.ok(isPromoCode("SOMJAI30") && !isPromoCode("bad code"));
  assert.equal(initials("คุณสมใจ ใจดี"), "ส");
  assert.equal(initials("somjai fit"), "SF");
  assert.equal(compactNumber(12500), "12.5K");
  const msg = registrationMessage({ name: "SJ", url: "https://x.test/r/abc", expiresAt: new Date("2026-11-26T05:00:00Z") });
  assert.match(msg, /https:\/\/x\.test\/r\/abc/);
  assert.match(msg, /26 พ\.ย\. 2569/);
});

test("CEO card message carries the reference, the pitch and the card link; an empty pitch leaves no blank line", () => {
  const url = "https://example.test/kol/ceo?card=00000000-0000-4000-8000-000000000001";
  const m = ceoCardMessage({ ref: "KOL-0007", name: "Mint", pitch: "สายฟิตเนส 12K", url });
  assert.equal(m, `มีการ์ด KOL รอ CEO พิจารณา\nKOL-0007 · Mint\nสายฟิตเนส 12K\nเปิดการ์ด: ${url}`);
  assert.ok(!ceoCardMessage({ ref: "KOL-0007", name: "Mint", pitch: "  ", url }).includes("\n\n"));
});

test("search by reference only when the query is a reference; digits inside a name never match another applicant", () => {
  for (const [q, n] of [["KOL-0026", 26], ["kol26", 26], ["KOL 7", 7], ["#12", 12], ["0026", 26], [" 26 ", 26]] as const) assert.equal(refFromQuery(q), n, q);
  for (const q of ["E2ESJaq6ao", "mint99", "0812345678x", "KOL-", "abc", ""]) assert.equal(refFromQuery(q), null, q);
});

test("social handle comes from the real profile link; links without a handle give none", () => {
  assert.equal(socialHandle("https://www.instagram.com/wonder.courts?cplk=MXBt"), "@wonder.courts");
  assert.equal(socialHandle("instagram.com/aeng_watt"), "@aeng_watt");
  assert.equal(socialHandle("https://www.tiktok.com/@aeng_watt?_r=1"), "@aeng_watt");
  assert.equal(socialHandle("https://youtube.com/@mint"), "@mint");
  assert.equal(socialHandle("https://www.facebook.com/profile.php?id=1"), null);
  assert.equal(socialHandle("https://www.instagram.com/p/Cx12/"), null);
  assert.equal(socialHandle("https://www.tiktok.com/"), null);
  assert.equal(socialHandle(null), null);
  assert.equal(socialHandle("not a url %%"), null);
});

test("decision reason: preset, note, or both; the backend still gets a non-empty reason", () => {
  assert.equal(decisionNote(REJECT_REASONS[0], ""), "ผู้ติดตามไม่ตรงกลุ่ม");
  assert.equal(decisionNote(INFO_REASONS[1], " ขอยอดวิวย้อนหลัง 30 วัน "), "ขอสถิติผู้ติดตาม — ขอยอดวิวย้อนหลัง 30 วัน");
  assert.equal(decisionNote("", "ขอโปรไฟล์ล่าสุด"), "ขอโปรไฟล์ล่าสุด");
  assert.equal(decisionNote(" ", " "), "");
});
