/* Run: npx tsx src/lib/activity.test.ts */
import assert from "node:assert/strict";
import {
  activityHref,
  buildActivitySummary,
  formatRelativeTime,
  formatUkDateTime,
  mergeActivity,
  type ActivityItem,
} from "./activity-shared";

const base = { record_type: "invoice", record_number: "INV-1022", client_name: "Michael and Christina" };

assert.equal(buildActivitySummary({ ...base, event_type: "link.viewed", metadata: {} }), "Invoice INV-1022 viewed by Michael and Christina");
assert.equal(buildActivitySummary({ ...base, event_type: "link.viewed", metadata: { first: true } }), "Invoice INV-1022 opened for the first time by Michael and Christina");
assert.equal(
  buildActivitySummary({ ...base, event_type: "email.sent", metadata: { recipients: ["a@x.com", "b@y.com"] } }),
  "Invoice INV-1022 emailed to a@x.com and b@y.com"
);
assert.equal(buildActivitySummary({ ...base, event_type: "email.sent", metadata: { recipients: "a@x.com, b@y.com" } }), "Invoice INV-1022 emailed to a@x.com and b@y.com");
assert.equal(buildActivitySummary({ ...base, event_type: "payment.recorded", metadata: { amount: 150 } }), "Payment of £150.00 recorded on Invoice INV-1022 (Michael and Christina)");
assert.equal(buildActivitySummary({ ...base, event_type: "email.opened", metadata: {} }), "Invoice INV-1022 email opened by Michael and Christina");
assert.equal(buildActivitySummary({ record_type: "contract", record_number: "C-1", client_name: "Sam", event_type: "contract.signed", metadata: { signed_name: "Sam Smith" } }), "Contract C-1 signed by Sam Smith");
assert.equal(buildActivitySummary({ record_type: null, record_number: null, client_name: null, event_type: "client.imported", metadata: { count: 3 } }), "3 clients imported");
assert.equal(buildActivitySummary({ record_type: "client", record_number: null, client_name: "Jo", event_type: "client.created", metadata: {} }), "New client Jo added");

assert.equal(activityHref({ event_type: "link.viewed", record_type: "invoice", record_id: "i1", metadata: {} }), "/invoices/i1");
assert.equal(activityHref({ event_type: "survey.booked", record_type: "survey", record_id: "j1", metadata: {} }), "/surveys/j1");
assert.equal(activityHref({ event_type: "survey_report.uploaded", record_type: "survey_report", record_id: "r1", metadata: { job_id: "j9" } }), "/surveys/j9");
assert.equal(activityHref({ event_type: "record.deleted", record_type: "invoice", record_id: "i1", metadata: {} }), null);

const now = new Date("2026-10-11T18:00:00Z");
assert.equal(formatRelativeTime("2026-10-11T16:00:00Z", now), "2 hours ago");
assert.equal(formatRelativeTime("2026-10-11T17:59:30Z", now), "just now");
assert.equal(formatRelativeTime("2026-10-10T17:00:00Z", now), "yesterday");
assert.match(formatUkDateTime("2026-10-11T16:05:00Z"), /17:05 BST/);

const item = (over: Partial<ActivityItem>): ActivityItem => ({
  id: Math.random().toString(),
  created_at: "2026-10-11T10:00:00.000Z",
  event_type: "email.sent",
  record_type: "quote",
  record_id: "q1",
  record_number: "Q-1",
  client_id: null,
  client_name: null,
  summary: "",
  metadata: {},
  ...over,
});

const merged = mergeActivity(
  [item({ id: "logged", created_at: "2026-10-11T10:00:03.000Z" })],
  [
    item({ id: "dup", created_at: "2026-10-11T10:00:00.000Z", derived: true }),
    item({ id: "older", created_at: "2026-10-01T10:00:00.000Z", derived: true }),
    item({ id: "view", event_type: "link.viewed", created_at: "2026-10-11T11:00:00.000Z", derived: true }),
  ]
);
assert.deepEqual(merged.map((m) => m.id), ["view", "logged", "older"]);

console.log("activity tests passed");
