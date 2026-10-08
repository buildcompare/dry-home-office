/*
 * Small server-rendered pieces shared by the Surveys list and detail.
 */

import { buildRecipientList, describeRecipients } from "@/lib/email-recipients";
import { formatCurrency } from "@/lib/money";
import type { SurveyRecord } from "@/lib/survey-records";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { markSurveyPaid, resendSurveyInvoice } from "./actions";

export function formatSentAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function surveyRecipients(record: SurveyRecord) {
  return buildRecipientList(record.client?.email, record.client?.secondaryEmail);
}

export function Banners({
  notice,
  warning,
  error,
  children,
}: {
  notice?: string;
  warning?: string;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
          {children}
        </div>
      )}

      {warning && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {warning}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </>
  );
}

export function ResendInvoiceForm({
  record,
  back,
  className,
}: {
  record: SurveyRecord;
  back: string;
  className: string;
}) {
  if (!record.invoice) return null;

  const recipients = surveyRecipients(record);
  const label = record.invoice.sentAt ? "Resend invoice" : "Send invoice";

  return (
    <form action={resendSurveyInvoice}>
      <input type="hidden" name="job_id" value={record.jobId} />
      <input type="hidden" name="back" value={back} />
      <ConfirmSubmitButton
        className={className}
        disabled={recipients.length === 0}
        title={recipients.length === 0 ? "The client has no email address" : undefined}
        pendingLabel="Sending…"
        confirmMessage={`Email invoice ${record.invoice.invoiceNumber} (${formatCurrency(
          record.invoice.total
        )}) with the PDF and online link to ${describeRecipients(recipients)}?`}
      >
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}

export function MarkPaidForm({
  record,
  back,
  className,
  withMethod = false,
}: {
  record: SurveyRecord;
  back: string;
  className: string;
  withMethod?: boolean;
}) {
  const invoice = record.invoice;

  if (!invoice || invoice.state === "paid" || invoice.outstanding <= 0.009) {
    return null;
  }

  return (
    <form action={markSurveyPaid} className={withMethod ? "flex flex-wrap items-center gap-2" : undefined}>
      <input type="hidden" name="job_id" value={record.jobId} />
      <input type="hidden" name="back" value={back} />

      {withMethod ? (
        <select
          name="payment_method"
          defaultValue="Bank Transfer"
          aria-label="Payment method"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option>Bank Transfer</option>
          <option>Card</option>
          <option>Cash</option>
          <option>Cheque</option>
          <option>Other</option>
        </select>
      ) : (
        <input type="hidden" name="payment_method" value="Bank Transfer" />
      )}

      <ConfirmSubmitButton
        className={className}
        pendingLabel="Saving…"
        confirmMessage={`Mark invoice ${invoice.invoiceNumber} as paid in full? This records a payment of ${formatCurrency(
          invoice.outstanding
        )} received today${withMethod ? "" : " by bank transfer"}.`}
      >
        Mark paid
      </ConfirmSubmitButton>
    </form>
  );
}
