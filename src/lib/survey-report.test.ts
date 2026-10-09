import assert from "node:assert/strict";
import {
  buildReportEmailDefaults,
  buildReportPath,
  defaultReportTitle,
  formatFileSize,
  isPdfFile,
  isReportPathForJob,
  looksLikePdf,
  reportDownloadName,
  reportSendsAsLink,
  safeStorageName,
} from "./survey-report-shared";
import { bearerToken, configuredUploadToken, tokensMatch } from "./upload-token";
import { isReportsSetupError } from "./survey-reports";

const job = "3f1c2a8e-1111-4a2b-9c3d-123456789abc";

assert.equal(defaultReportTitle("Damp_Report  Oak Lane.PDF"), "Damp Report Oak Lane");
assert.equal(defaultReportTitle(".pdf"), "Survey report");
assert.equal(safeStorageName("Rapport d'humidité (final).pdf"), "Rapport-d-humidite-final.pdf");
assert.equal(safeStorageName("../../etc/passwd"), "passwd.pdf");
assert.equal(safeStorageName("..pdf"), "report.pdf");
const path = buildReportPath(job, "abc-123", "My Report.pdf");
assert.equal(path, `${job}/abc-123-My-Report.pdf`);
assert.equal(isReportPathForJob(path, job), true);
assert.equal(isReportPathForJob(`${job}/../other/x.pdf`, job), false);
assert.equal(isReportPathForJob(`other/${path}`, job), false);
assert.equal(isReportPathForJob(`${job}/x.exe`, job), false);
assert.equal(isPdfFile({ name: "a.pdf", type: "application/pdf" }), true);
assert.equal(isPdfFile({ name: "a.pdf", type: "" }), true);
assert.equal(isPdfFile({ name: "a.docx", type: "application/msword" }), false);
assert.equal(isPdfFile({ name: "a.png", type: "" }), false);
assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7 ...")), true);
assert.equal(looksLikePdf(new TextEncoder().encode("<html>")), false);
assert.equal(reportDownloadName({ title: "Survey: 12/Oak", file_name: "x.pdf" }), "Survey  12 Oak.pdf");
assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.5 MB");
assert.equal(reportSendsAsLink(9 * 1024 * 1024), false);
assert.equal(reportSendsAsLink(11 * 1024 * 1024), true);

const attached = buildReportEmailDefaults({ clientName: "Sarah", siteText: "12 Oak Lane, Reading", asLink: false });
assert.equal(attached.subject, "Your damp survey report – 12 Oak Lane, Reading");
assert.match(attached.body, /^Hi Sarah,/);
assert.match(attached.body, /attached/);
assert.match(buildReportEmailDefaults({ clientName: null, siteText: "", asLink: true }).body, /secure link/);
assert.equal(buildReportEmailDefaults({ clientName: null, siteText: null, asLink: false }).subject, "Your damp survey report");

assert.equal(configuredUploadToken(undefined), null);
assert.equal(configuredUploadToken("short"), null);
assert.equal(configuredUploadToken("  " + "x".repeat(32) + " "), "x".repeat(32));
assert.equal(bearerToken("Bearer abc"), "abc");
assert.equal(bearerToken("bearer abc "), "abc");
assert.equal(bearerToken("Basic abc"), null);
assert.equal(bearerToken(null), null);
assert.equal(tokensMatch("x".repeat(32), "x".repeat(32)), true);
assert.equal(tokensMatch("x".repeat(31), "x".repeat(32)), false);

assert.equal(isReportsSetupError({ code: "PGRST205", message: "Could not find the table 'public.survey_reports' in the schema cache" }), true);
assert.equal(isReportsSetupError({ code: "42P01", message: 'relation "survey_reports" does not exist' }), true);
assert.equal(isReportsSetupError({ message: "Bucket not found" }), true);
assert.equal(isReportsSetupError({ code: "23505", message: "duplicate key" }), false);
assert.equal(isReportsSetupError(null), false);

console.log("survey report helpers: all tests passed");
