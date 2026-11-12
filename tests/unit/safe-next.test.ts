import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../../lib/safe-next.ts";

test("after sign-in: internal paths are kept, query included", () => {
  assert.equal(safeNext("/kol/ceo?card=fb9addcd-a8f8-464f-9f85-7f1fcfc400b4"), "/kol/ceo?card=fb9addcd-a8f8-464f-9f85-7f1fcfc400b4");
  assert.equal(safeNext("/calendar"), "/calendar");
});

test("after sign-in: anything that could leave the site or loop back to sign-in is refused", () => {
  for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example", "\\\\evil", "javascript:alert(1)", "kol/ceo",
    "/sign-in", "/sign-in?next=/kol", "/", "/a\nb", "/a\rb", "x".repeat(600), null, undefined, 12]) {
    assert.equal(safeNext(bad as unknown), null, JSON.stringify(bad));
  }
  assert.equal(safeNext("/%0d%0aSet-Cookie:x"), "/%0d%0aSet-Cookie:x"); // stays an encoded path on this site
});
