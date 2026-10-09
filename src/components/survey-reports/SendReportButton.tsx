"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { sendSurveyReport } from "@/app/surveys/report-actions";
import { buildReportEmailDefaults, reportSendsAsLink } from "@/lib/survey-report-shared";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500";

export default function SendReportButton({
  jobId,
  reportId,
  reportTitle,
  sizeBytes,
  alreadySent,
  clientName,
  primaryEmail,
  secondaryEmail,
  siteText,
  className,
}: {
  jobId: string;
  reportId: string;
  reportTitle: string;
  sizeBytes: number | null;
  alreadySent: boolean;
  clientName: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  siteText: string | null;
  className?: string;
}) {
  const router = useRouter();
  const asLink = reportSendsAsLink(sizeBytes);
  const defaults = buildReportEmailDefaults({ clientName, siteText, asLink });

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(primaryEmail ?? "");
  const [also, setAlso] = useState(secondaryEmail ?? "");
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function openComposer() {
    setTo(primaryEmail ?? "");
    setAlso(secondaryEmail && secondaryEmail !== primaryEmail ? secondaryEmail : "");
    setSubject(defaults.subject);
    setBody(defaults.body);
    setError(null);
    setResult(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      const sent = await sendSurveyReport({ jobId, reportId, to, also, subject, body });

      if (!sent.ok) {
        setError(sent.error);
        return;
      }

      setResult(sent.warning ? `${sent.message} ${sent.warning}` : sent.message);
      setOpen(false);
      router.refresh();
    } catch {
      setError("The report could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openComposer} className={className}>
        {alreadySent ? "Send again" : "Send to customer"}
      </button>

      {result && !open && (
        <span role="status" className="basis-full text-xs font-medium text-emerald-700">
          {result}
        </span>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Send survey report</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{reportTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {asLink
                    ? "This PDF is over 10 MB, so the customer gets a secure download link (valid 14 days) instead of an attachment."
                    : "The PDF is attached to the email."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <label className="block text-sm font-semibold text-slate-700">
                  To
                  <input
                    type="email"
                    spellCheck={false}
                    required
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    disabled={sending}
                    className={inputClass}
                  />
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  Changing this address only affects this email. It does not change the client record.
                </p>

                <label className="mt-5 block text-sm font-semibold text-slate-700">
                  Also send to <span className="font-normal text-slate-400">(secondary email, optional)</span>
                  <input
                    type="email"
                    spellCheck={false}
                    value={also}
                    onChange={(event) => setAlso(event.target.value)}
                    disabled={sending}
                    placeholder="Leave blank to send to the main address only"
                    className={inputClass}
                  />
                </label>

                <label className="mt-5 block text-sm font-semibold text-slate-700">
                  Subject
                  <input
                    type="text"
                    spellCheck
                    required
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={sending}
                    className={inputClass}
                  />
                </label>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor={`report-body-${reportId}`} className="block text-sm font-semibold text-slate-700">
                      Email message
                    </label>
                    <button
                      type="button"
                      onClick={() => setBody(defaults.body)}
                      disabled={sending}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                    >
                      Reset message
                    </button>
                  </div>
                  <textarea
                    id={`report-body-${reportId}`}
                    spellCheck
                    required
                    rows={11}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    disabled={sending}
                    className={`${inputClass} resize-y leading-6`}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {sending ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
