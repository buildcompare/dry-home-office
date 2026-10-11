/* Run: npx tsx src/lib/svix-verify.test.ts */
import assert from "node:assert/strict";
import { svixSignature, verifySvixSignature } from "./svix-verify";

const secret = "whsec_" + Buffer.from("test-secret-key-0123456789").toString("base64");
const body = JSON.stringify({ type: "email.opened", data: { email_id: "abc" } });
const id = "msg_123";
const ts = "1760000000";
const sig = svixSignature(secret, id, ts, body);

assert.equal(verifySvixSignature(secret, { id, timestamp: ts, signature: `v1,${sig}` }, body, 1760000010), true);
assert.equal(verifySvixSignature(secret, { id, timestamp: ts, signature: `v1,bad v1,${sig}` }, body, 1760000010), true);
assert.equal(verifySvixSignature(secret, { id, timestamp: ts, signature: `v1,${sig}` }, body + " ", 1760000010), false);
assert.equal(verifySvixSignature(secret, { id, timestamp: ts, signature: `v1,${sig}` }, body, 1760009999), false, "too old");
assert.equal(verifySvixSignature(secret, { id: null, timestamp: ts, signature: `v1,${sig}` }, body, 1760000010), false);
assert.equal(verifySvixSignature("", { id, timestamp: ts, signature: `v1,${sig}` }, body), false);
console.log("svix-verify tests passed");
