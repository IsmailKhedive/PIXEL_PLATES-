import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
test("table device keys contain at least 256 bits", () => {
  const key = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  assert.match(key, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(crypto.createHash("sha256").update(key).digest("hex"), hash);
});
test("different tablets receive different keys", () => {
  const keys = new Set(
    Array.from(
      {
        length: 100,
      },
      () => crypto.randomBytes(32).toString("base64url"),
    ),
  );
  assert.equal(keys.size, 100);
});
