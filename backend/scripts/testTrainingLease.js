const assert = require("node:assert/strict");
const crypto = require("node:crypto");

function sameLeaseToken(provided, expected) {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const token = crypto.randomBytes(32).toString("hex");
const anotherToken = crypto.randomBytes(32).toString("hex");

assert.equal(sameLeaseToken(token, token), true);
assert.equal(sameLeaseToken(token, anotherToken), false);
assert.equal(sameLeaseToken("", token), false);
assert.equal(sameLeaseToken(token, ""), false);
assert.equal(sameLeaseToken("invalid", token), false);

console.log("PASS: Training Lease Token tests");