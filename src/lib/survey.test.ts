import assert from "node:assert/strict";
import {
  addMinutesToTime,
  buildSurveyBookedNotice,
  buildSurveyItemDescription,
  buildSurveyJobTitle,
  clientMatchesQuery,
  formatAddress,
  formatSurveyWhen,
  isEndAfterStart,
  isSurveyDueSoon,
  isSurveyInvoice,
  isSurveyJob,
  isValidDateKey,
  parseSurveyFee,
  safeSurveysPath,
  searchClients,
  suggestedNameFromQuery,
  surveyFeeLock,
  surveyInvoiceState,
  surveyPaymentState,
  withQueryParam,
  type SurveyClientOption,
} from "./survey";

function client(overrides: Partial<SurveyClientOption>): SurveyClientOption {
  return {
    id: "x",
    name: "Client",
    company: null,
    email: null,
    secondaryEmail: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    town: null,
    county: null,
    postcode: null,
    ...overrides,
  };
}

const sarah = client({
  id: "1",
  name: "Sarah Thompson",
  company: "Thompson Lettings Ltd",
  email: "sarah@example.com",
  secondaryEmail: "accounts@thompsonlettings.example",
  phone: "07700 900123",
  postcode: "RG1 2AB",
});
const mark = client({
  id: "2",
  name: "Mark Johnson",
  email: "mark.j@example.org",
  phone: "+44 118 974 0020",
  postcode: "RG40 1AA",
});
const anna = client({ id: "3", name: "Anna Smith", postcode: "SL4 5QT" });
const all = [sarah, mark, anna];

// Search: name, company, email, secondary email, phone, postcode.
assert.deepEqual(searchClients(all, "sarah").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "THOMPSON lett").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "mark.j@").map((c) => c.id), ["2"]);
assert.deepEqual(searchClients(all, "accounts@thompson").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "07700900123").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "07700 900").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "+447700900123").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "0118 974").map((c) => c.id), ["2"]);
assert.deepEqual(searchClients(all, "rg12ab").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "rg1 2ab").map((c) => c.id), ["1"]);
assert.deepEqual(searchClients(all, "rg40").map((c) => c.id), ["2"]);
assert.deepEqual(searchClients(all, "sl4 5qt").map((c) => c.id), ["3"]);
assert.deepEqual(searchClients(all, "nobody here"), []);
assert.deepEqual(searchClients(all, "   "), []);
assert.equal(clientMatchesQuery(anna, "smith"), true);
assert.equal(clientMatchesQuery(anna, "smith reading"), false);
// Name starts-with ranks first.
const smiths = [client({ id: "a", name: "Jo Blacksmith" }), client({ id: "b", name: "Smith Bros" })];
assert.deepEqual(searchClients(smiths, "smith").map((c) => c.id), ["b", "a"]);
// Result list is kept short.
const many = Array.from({ length: 20 }, (_, i) => client({ id: String(i), name: `Smith ${i}` }));
assert.equal(searchClients(many, "smith").length, 8);

assert.equal(suggestedNameFromQuery("  Jane Doe "), "Jane Doe");
assert.equal(suggestedNameFromQuery("jane@x.com"), "");
assert.equal(suggestedNameFromQuery("RG1 2AB"), "");

// Titles.
assert.equal(buildSurveyJobTitle({ address_line_1: "12 Oak Lane", town: "Reading" }), "Damp survey – Reading");
assert.equal(buildSurveyJobTitle({ address_line_1: "12 Oak Lane", town: " " }), "Damp survey – 12 Oak Lane");
assert.equal(buildSurveyJobTitle({ postcode: "RG1 2AB" }), "Damp survey – RG1 2AB");
assert.equal(buildSurveyJobTitle(null), "Damp survey");

assert.equal(
  formatAddress({ address_line_1: "12 Oak Lane", address_line_2: "", town: "Reading", postcode: "RG1 2AB" }),
  "12 Oak Lane, Reading, RG1 2AB"
);

// Dates and times.
assert.equal(isValidDateKey("2026-10-08"), true);
assert.equal(isValidDateKey("2026-02-30"), false);
assert.equal(addMinutesToTime("09:00", 60), "10:00");
assert.equal(addMinutesToTime("09:45", 60), "10:45");
assert.equal(addMinutesToTime("23:30", 60), "23:59");
assert.equal(addMinutesToTime("", 60), "");
assert.equal(isEndAfterStart("09:00", "10:00"), true);
assert.equal(isEndAfterStart("10:00", "10:00"), false);
assert.equal(formatSurveyWhen("2026-10-08", "09:00", "10:00"), "Thursday 8 October 2026 at 09:00–10:00");
assert.equal(formatSurveyWhen("2026-10-08", "09:00:00", null), "Thursday 8 October 2026 at 09:00");
assert.equal(
  buildSurveyItemDescription("2026-10-08", "09:00", { address_line_1: "12 Oak Lane", town: "Reading", postcode: "RG1 2AB" }),
  "Damp survey – Thursday 8 October 2026 at 09:00 – 12 Oak Lane, Reading, RG1 2AB"
);
assert.equal(isSurveyDueSoon("2026-10-07", "2026-10-07"), true);
assert.equal(isSurveyDueSoon("2026-10-10", "2026-10-07"), true);
assert.equal(isSurveyDueSoon("2026-10-11", "2026-10-07"), false);
assert.equal(isSurveyDueSoon("2026-10-06", "2026-10-07"), false);
assert.equal(isSurveyDueSoon(null, "2026-10-07"), false);

// Fee.
assert.equal(parseSurveyFee("250"), 250);
assert.equal(parseSurveyFee("£1,250.50"), 1250.5);
assert.equal(parseSurveyFee("0"), null);
assert.equal(parseSurveyFee(""), null);
assert.equal(parseSurveyFee("12.345"), null);
assert.equal(parseSurveyFee("-5"), null);
assert.equal(parseSurveyFee("abc"), null);

// Survey jobs and payment state.
assert.equal(isSurveyJob({ job_type: "Damp Survey", title: "Anything" }), true);
assert.equal(isSurveyJob({ job_type: "Other", title: "Damp survey – Reading" }), true);
assert.equal(isSurveyJob({ job_type: "Rising Damp", title: "Rising damp works" }), false);
assert.equal(isSurveyInvoice({ title: "Damp survey" }), true);
assert.equal(isSurveyInvoice({ title: "Deposit" }), false);

const surveyJob = { job_type: "Damp Survey", title: "Damp survey – Reading" };
assert.equal(surveyPaymentState(surveyJob, []), null);
assert.equal(surveyPaymentState({ job_type: "Rising Damp", title: "Works" }, [{ title: "Damp survey", status: "Sent", amount: 250 }]), null);
assert.equal(surveyPaymentState(surveyJob, [{ title: "Damp survey", status: "Sent", amount: 250, amount_paid: 0 }]), "unpaid");
assert.equal(surveyPaymentState(surveyJob, [{ title: "Damp survey", status: "Part Paid", amount: 250, amount_paid: 100 }]), "unpaid");
assert.equal(surveyPaymentState(surveyJob, [{ title: "Damp survey", status: "Paid", amount: 250, amount_paid: 250 }]), "paid");
assert.equal(surveyPaymentState(surveyJob, [{ title: "Damp survey", status: "Sent", amount: 250, amount_paid: 250 }]), "paid");
// Cancelled survey invoices and works invoices are ignored.
assert.equal(
  surveyPaymentState(surveyJob, [
    { title: "Damp survey", status: "Cancelled", amount: 250 },
    { title: "Damp survey", status: "Paid", amount: 250, amount_paid: 250 },
    { title: "Rising damp works", status: "Sent", amount: 4000 },
  ]),
  "paid"
);

// Only real survey invoices count: not deposits, interims or quote/contract invoices.
assert.equal(isSurveyInvoice({ title: "Damp survey", invoice_type: "Deposit" }), false);
assert.equal(isSurveyInvoice({ title: "Damp survey", invoice_type: "Interim" }), false);
assert.equal(isSurveyInvoice({ title: "Damp survey", quote_id: "q1" }), false);
assert.equal(isSurveyInvoice({ title: "Damp survey", contract_id: "c1" }), false);
assert.equal(isSurveyInvoice({ title: "Damp survey", invoice_type: "Final", quote_id: null }), true);

// Drafts are not "unpaid" until issued.
assert.equal(surveyInvoiceState({ title: "Damp survey", status: "Draft", amount: 250 }), "draft");
assert.equal(surveyInvoiceState({ title: "Damp survey", status: "Viewed", amount: 250 }), "unpaid");
assert.equal(surveyInvoiceState({ title: "Damp survey", status: "Overdue", amount: 250 }), "unpaid");
assert.equal(surveyInvoiceState({ title: "Damp survey", status: "Void", amount: 250 }), null);
assert.equal(surveyPaymentState(surveyJob, [{ title: "Damp survey", status: "Draft", amount: 250 }]), "draft");
assert.equal(
  surveyPaymentState(surveyJob, [
    { title: "Damp survey", status: "Draft", amount: 250 },
    { title: "Damp survey", status: "Sent", amount: 250 },
  ]),
  "unpaid"
);
// The JOB-1001 case: deposit drafts on a works job are never survey invoices.
assert.equal(
  surveyPaymentState(surveyJob, [{ title: "Damp survey deposit", status: "Draft", amount: 500, invoice_type: "Deposit", quote_id: "q" }]),
  null
);

// Redirect targets stay inside /surveys.
assert.equal(safeSurveysPath("/surveys?view=past", "/surveys"), "/surveys?view=past");
assert.equal(safeSurveysPath("/surveys/abc-123", "/surveys"), "/surveys/abc-123");
assert.equal(safeSurveysPath("https://evil.example", "/surveys"), "/surveys");
assert.equal(safeSurveysPath("//evil.example", "/surveys"), "/surveys");
assert.equal(safeSurveysPath(null, "/surveys"), "/surveys");
assert.equal(withQueryParam("/surveys?view=past&notice=old", "notice", "Sent"), "/surveys?view=past&notice=Sent");
assert.equal(withQueryParam("/surveys/abc", "error", "a b"), "/surveys/abc?error=a+b");

// Fee lock.
const openInvoice = { status: "Sent", amountPaid: 0, state: "unpaid" as const, items: [{ id: "i" }] };
assert.equal(surveyFeeLock(openInvoice), null);
assert.equal(surveyFeeLock({ ...openInvoice, status: "Draft", state: "draft" }), null);
assert.match(surveyFeeLock({ ...openInvoice, status: "Paid", state: "paid" }) ?? "", /paid/);
assert.match(surveyFeeLock({ ...openInvoice, status: "Part Paid", amountPaid: 50 }) ?? "", /payment/);
assert.match(surveyFeeLock({ ...openInvoice, items: [{ id: "a" }, { id: "b" }] }) ?? "", /more than one line/);
assert.match(surveyFeeLock(null) ?? "", /no survey invoice/);

// Success banner.
assert.equal(
  buildSurveyBookedNotice({
    when: "Thursday 8 October 2026 at 09:00–10:00",
    invoiceNumber: "INV-1042",
    email: { status: "sent", recipients: ["sarah@example.com", "accounts@thompsonlettings.example"] },
  }),
  "Survey booked for Thursday 8 October 2026 at 09:00–10:00. Invoice INV-1042 created and emailed to sarah@example.com and accounts@thompsonlettings.example."
);
assert.match(
  buildSurveyBookedNotice({ when: "x", invoiceNumber: "INV-1", email: { status: "no-email" } }),
  /not emailed because the client has no email address/
);
assert.match(
  buildSurveyBookedNotice({ when: "x", invoiceNumber: "INV-1", email: { status: "not-requested" } }),
  /INV-1 created \(not emailed\)/
);
assert.equal(
  buildSurveyBookedNotice({ when: "x", invoiceNumber: null, email: { status: "no-invoice" } }),
  "Survey booked for x."
);

console.log("survey helpers: all tests passed");
