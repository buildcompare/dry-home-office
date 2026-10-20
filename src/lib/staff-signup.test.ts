import assert from "node:assert/strict";
import { formatUkDateTime, signupStatus } from "./staff-signup";

assert.deepEqual(signupStatus(null, "2026-10-01T10:00:00Z"), { state: "invited", invitedAt: "2026-10-01T10:00:00Z" });
// New invite, link clicked (signed in) but no password yet → still invited
assert.equal(signupStatus({ id: "1", last_sign_in_at: "2026-10-02T10:00:00Z", user_metadata: { invite_pending: true } }, null).state, "invited");
// Password set → signed up
const s = signupStatus({ id: "1", last_sign_in_at: "2026-10-03T09:00:00Z", user_metadata: { invite_pending: false, password_set_at: "2026-10-02T10:05:00Z" } }, null);
assert.deepEqual(s, { state: "signed_up", signedUpAt: "2026-10-02T10:05:00Z", lastSignInAt: "2026-10-03T09:00:00Z" });
// Older account without markers: signed in once → signed up
assert.equal(signupStatus({ id: "1", last_sign_in_at: "2026-09-01T09:00:00Z", email_confirmed_at: "2026-08-30T09:00:00Z" }, null).state, "signed_up");
assert.equal(signupStatus({ id: "1", last_sign_in_at: null }, null).state, "invited");
assert.equal(formatUkDateTime("2026-10-20T20:54:00Z"), "20 Oct 2026, 21:54");
console.log("signup tests passed");
