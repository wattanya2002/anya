import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITIONS, canTransition, APPLICANT_STATUSES, BUCKET_STATUSES, creditSummary, deliverableProgress, applicantRef, meetsFollowerRule,
  suggestPromoCode, isPromoCode, registrationMessage, initials, compactNumber, parseBucket, parseCeoTab, STATUS_LABEL, PUBLIC_STATUS, ceoCardMessage,
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
