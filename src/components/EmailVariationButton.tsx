"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type EmailVariationButtonProps = {
  variationId: string;
  recipient?: string | null;
  status: string;
};

type ComposerPreview = {
  recipient: string;
  subject: string;
  body: string;
};

const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_SIZE =
  4 * 1024 * 1024;

export default function EmailVariationButton({
  variationId,
  recipient,
  status,
}: EmailVariationButtonProps) {
  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [to, setTo] =
    useState(
      recipient ?? ""
    );

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [
    templateSubject,
    setTemplateSubject,
  ] = useState("");

  const [
    templateBody,
    setTemplateBody,
  ] = useState("");

  const [
    attachments,
    setAttachments,
  ] = useState<File[]>([]);

  const [
    attachmentKey,
    setAttachmentKey,
  ] = useState(0);

  const openComposer =
    async () => {
      setOpen(true);
      setLoading(true);
      setError("");
      setAttachments([]);

      try {
        const response =
          await fetch(
            `/variations/${variationId}/send`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as
            | ComposerPreview
            | {
                error?: string;
              };

        if (
          !response.ok
        ) {
          throw new Error(
            "error" in data &&
              data.error
              ? data.error
              : "Unable to prepare the email."
          );
        }

        const preview =
          data as ComposerPreview;

        setTo(
          preview.recipient ||
            recipient ||
            ""
        );

        setSubject(
          preview.subject
        );

        setBody(
          preview.body
        );

        setTemplateSubject(
          preview.subject
        );

        setTemplateBody(
          preview.body
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to prepare the email."
        );
      } finally {
        setLoading(false);
      }
    };

  const closeComposer =
    () => {
      if (sending) {
        return;
      }

      setOpen(false);
      setError("");
    };

  const resetTemplate =
    () => {
      setSubject(
        templateSubject
      );

      setBody(
        templateBody
      );

      setError("");
    };

  const handleAttachments =
    (
      event: ChangeEvent<HTMLInputElement>
    ) => {
      setError("");

      const selected =
        Array.from(
          event.target.files ??
            []
        );

      if (
        selected.length >
        MAX_ATTACHMENTS
      ) {
        setError(
          `You can attach a maximum of ${MAX_ATTACHMENTS} files.`
        );

        event.target.value =
          "";

        return;
      }

      const totalSize =
        selected.reduce(
          (
            total,
            file
          ) =>
            total +
            file.size,
          0
        );

      if (
        totalSize >
        MAX_TOTAL_SIZE
      ) {
        setError(
          "Attachments must be no more than 4 MB combined."
        );

        event.target.value =
          "";

        return;
      }

      setAttachments(
        selected
      );
    };

  const removeAttachment =
    (
      index: number
    ) => {
      setAttachments(
        (
          current
        ) =>
          current.filter(
            (
              _file,
              fileIndex
            ) =>
              fileIndex !==
              index
          )
      );

      setAttachmentKey(
        (
          current
        ) =>
          current + 1
      );
    };

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setError("");

      const cleanTo =
        to.trim();

      const cleanSubject =
        subject.trim();

      const cleanBody =
        body.trim();

      if (!cleanTo) {
        setError(
          "Please enter an email address."
        );
        return;
      }

      if (
        !cleanTo.includes(
          "@"
        )
      ) {
        setError(
          "Please enter a valid email address."
        );
        return;
      }

      if (!cleanSubject) {
        setError(
          "Please enter an email subject."
        );
        return;
      }

      if (!cleanBody) {
        setError(
          "Please enter an email message."
        );
        return;
      }

      if (
        attachments.length >
        MAX_ATTACHMENTS
      ) {
        setError(
          `You can attach a maximum of ${MAX_ATTACHMENTS} files.`
        );
        return;
      }

      const totalSize =
        attachments.reduce(
          (
            total,
            file
          ) =>
            total +
            file.size,
          0
        );

      if (
        totalSize >
        MAX_TOTAL_SIZE
      ) {
        setError(
          "Attachments must be no more than 4 MB combined."
        );
        return;
      }

      setSending(true);

      try {
        const formData =
          new FormData();

        formData.set(
          "recipient",
          cleanTo
        );

        formData.set(
          "subject",
          cleanSubject
        );

        formData.set(
          "body",
          cleanBody
        );

        attachments.forEach(
          (
            file
          ) => {
            formData.append(
              "attachments",
              file
            );
          }
        );

        const response =
          await fetch(
            `/variations/${variationId}/send`,
            {
              method: "POST",

              headers: {
                "x-dryhome-composer":
                  "1",
              },

              body: formData,
            }
          );

        const data =
          (await response.json()) as {
            error?: string;
            success?: boolean;
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Variation email could not be sent."
          );
        }

        window.location.href =
          `/variations/${variationId}?sent=1`;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Variation email could not be sent."
        );

        setSending(false);
      }
    };

  const buttonLabel =
    status === "Draft"
      ? "Email Variation"
      : "Send Again";

  return (
    <>
      <button
        type="button"
        onClick={
          openComposer
        }
        className="rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        style={{
          backgroundColor:
            "#d97706",
        }}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4">
          <div className="flex min-h-full items-center justify-center py-8">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* HEADER */}

              <div
                className="px-6 py-5 text-white"
                style={{
                  backgroundColor:
                    "#d97706",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
                      DryHome Office
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      Email Variation
                    </h2>

                    <p className="mt-1 text-sm text-amber-50">
                      Review the email before sending it to the customer.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeComposer
                    }
                    disabled={
                      sending
                    }
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-slate-500">
                    Preparing email…
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="p-6"
                >
                  {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {error}
                    </div>
                  )}

                  {/* TO */}

                  <div>
                    <label
                      htmlFor="variation-email-to"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      To
                    </label>

                    <input
                      id="variation-email-to"
                      type="email"
                      value={
                        to
                      }
                      onChange={(
                        event
                      ) =>
                        setTo(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-500"
                      placeholder="customer@example.com"
                    />

                    <p className="mt-2 text-xs text-slate-400">
                      Changing this address only affects this email. It will not change the client record.
                    </p>
                  </div>

                  {/* SUBJECT */}

                  <div className="mt-5">
                    <label
                      htmlFor="variation-email-subject"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Subject
                    </label>

                    <input
                      id="variation-email-subject"
                      type="text"
                      value={
                        subject
                      }
                      onChange={(
                        event
                      ) =>
                        setSubject(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* MESSAGE */}

                  <div className="mt-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <label
                        htmlFor="variation-email-body"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Email Message
                      </label>

                      <button
                        type="button"
                        onClick={
                          resetTemplate
                        }
                        className="text-xs font-semibold text-amber-700 hover:underline"
                      >
                        Reset to Template
                      </button>
                    </div>

                    <textarea
                      id="variation-email-body"
                      rows={14}
                      value={
                        body
                      }
                      onChange={(
                        event
                      ) =>
                        setBody(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* SECURE LINK */}

                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">
                      Secure variation link included automatically
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      The customer will receive a secure button to view the additional works and, once we complete the customer page, accept or decline the variation. The secure link cannot accidentally be removed from the editable message.
                    </p>
                  </div>

                  {/* ATTACHMENTS */}

                  <div className="mt-5">
                    <label
                      htmlFor="variation-email-attachments"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Add Attachments
                    </label>

                    <input
                      key={
                        attachmentKey
                      }
                      id="variation-email-attachments"
                      type="file"
                      multiple
                      onChange={
                        handleAttachments
                      }
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-600"
                    />

                    <p className="mt-2 text-xs text-slate-400">
                      Maximum 5 files, 4 MB combined.
                    </p>

                    {attachments.length >
                      0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map(
                          (
                            file,
                            index
                          ) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-700">
                                  {
                                    file.name
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {formatFileSize(
                                    file.size
                                  )}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeAttachment(
                                    index
                                  )
                                }
                                className="text-xs font-semibold text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}

                  <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
                    <button
                      type="button"
                      onClick={
                        closeComposer
                      }
                      disabled={
                        sending
                      }
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={
                        sending
                      }
                      className="rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor:
                          "#d97706",
                      }}
                    >
                      {sending
                        ? "Sending…"
                        : "Send Variation"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatFileSize(
  bytes: number
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} bytes`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    bytes /
    (1024 *
      1024)
  ).toFixed(
    1
  )} MB`;
}