import assert from "node:assert/strict";
import {
  buildRecipientList,
  describeRecipients,
  formatSentTo,
  isValidEmailAddress,
  toResendRecipients,
} from "./email-recipients";
import { isMissingSecondaryEmailColumn } from "./client-secondary-email";

// Primary only: unchanged behaviour (single string to Resend).
assert.deepEqual(buildRecipientList("jo@example.com", null), ["jo@example.com"]);
assert.equal(toResendRecipients(["jo@example.com"]), "jo@example.com");
assert.equal(formatSentTo(["jo@example.com"]), "jo@example.com");
assert.equal(describeRecipients(["jo@example.com"]), "jo@example.com");

// Both: primary first, array to Resend.
const both = buildRecipientList(" jo@example.com ", "sam@example.com");
assert.deepEqual(both, ["jo@example.com", "sam@example.com"]);
assert.deepEqual(toResendRecipients(both), ["jo@example.com", "sam@example.com"]);
assert.equal(formatSentTo(both), "jo@example.com, sam@example.com");
assert.equal(describeRecipients(both), "jo@example.com and sam@example.com");

// Case-insensitive dedupe and blanks skipped.
assert.deepEqual(buildRecipientList("Jo@Example.com", "jo@example.COM"), ["Jo@Example.com"]);
assert.deepEqual(buildRecipientList("", "  ", undefined, "sam@example.com"), ["sam@example.com"]);
assert.deepEqual(buildRecipientList(null, undefined), []);

// Validation.
assert.equal(isValidEmailAddress("sam@example.com"), true);
assert.equal(isValidEmailAddress("not-an-email"), false);
assert.equal(isValidEmailAddress("a b@example.com"), false);

// Missing-column detection (migration not applied yet).
assert.equal(
  isMissingSecondaryEmailColumn({
    code: "PGRST204",
    message: "Could not find the 'secondary_email' column of 'clients' in the schema cache",
  }),
  true
);
assert.equal(
  isMissingSecondaryEmailColumn({
    code: "42703",
    message: "column clients.secondary_email does not exist",
  }),
  true
);
assert.equal(
  isMissingSecondaryEmailColumn({ code: "23505", message: "duplicate key value" }),
  false
);
assert.equal(isMissingSecondaryEmailColumn(null), false);

console.log("email-recipients tests passed");
