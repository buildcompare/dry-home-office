"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type EmailContractButtonProps = {
  contractId: string;
  recipient: string | null;
  status: string;
};

type ComposerData = {
  recipient: string;
  subject: string;
  body: string;
};

const MAX_ATTACHMENTS = 5;

const MAX_TOTAL_ATTACHMENT_SIZE =
  4 * 1024 * 1024;

export default function EmailContractButton({
  contractId,
  recipient,
  status,
}: EmailContractButtonProps) {
  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [emailTo, setEmailTo] =
    useState(
      recipient || ""
    );

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [
    originalSubject,
    setOriginalSubject,
  ] = useState("");

  const [
    originalBody,
    setOriginalBody,
  ] = useState("");

  const [
    attachments,
    setAttachments,
  ] = useState<File[]>([]);

  const hasEmail =
    Boolean(recipient);

  async function openComposer() {
    if (!recipient) {
      return;
    }

    setOpen(true);
    setLoading(true);
    setError(null);
    setAttachments([]);

    try {
      const response =
        await fetch(
          `/contracts/${contractId}/send`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        (await response.json()) as
          | ComposerData
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in data &&
          data.error
            ? data.error
            : "Unable to load the email."
        );
      }

      const composerData =
        data as ComposerData;

      setEmailTo(
        composerData.recipient ||
          recipient
      );

      setSubject(
        composerData.subject
      );

      setBody(
        composerData.body
      );

      setOriginalSubject(
        composerData.subject
      );

      setOriginalBody(
        composerData.body
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the email."
      );
    } finally {
      setLoading(false);
    }
  }

  function closeComposer() {
    if (sending) {
      return;
    }

    setOpen(false);
    setError(null);
    setAttachments([]);
  }

  function resetTemplate() {
    setSubject(
      originalSubject
    );

    setBody(
      originalBody
    );

    setError(null);
  }

  function handleAttachments(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files ||
          []
      );

    event.target.value = "";

    if (
      files.length === 0
    ) {
      return;
    }

    const combined = [
      ...attachments,
      ...files,
    ];

    if (
      combined.length >
      MAX_ATTACHMENTS
    ) {
      setError(
        `You can add up to ${MAX_ATTACHMENTS} extra attachments.`
      );

      return;
    }

    const totalSize =
      combined.reduce(
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
      MAX_TOTAL_ATTACHMENT_SIZE
    ) {
      setError(
        "Extra attachments must be under 4 MB in total."
      );

      return;
    }

    setAttachments(
      combined
    );

    setError(null);
  }

  function removeAttachment(
    index: number
  ) {
    setAttachments(
      (current) =>
        current.filter(
          (
            _file,
            fileIndex
          ) =>
            fileIndex !==
            index
        )
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError(null);

    if (
      !emailTo.trim()
    ) {
      setError(
        "Please enter an email address."
      );

      return;
    }

    if (
      !subject.trim()
    ) {
      setError(
        "Please enter an email subject."
      );

      return;
    }

    if (!body.trim()) {
      setError(
        "Please enter an email message."
      );

      return;
    }

    const confirmed =
      window.confirm(
        status === "Draft"
          ? `Send this contract to ${emailTo}?`
          : `Send this contract again to ${emailTo}?`
      );

    if (!confirmed) {
      return;
    }

    setSending(true);

    try {
      const formData =
        new FormData();

      formData.set(
        "recipient",
        emailTo.trim()
      );

      formData.set(
        "subject",
        subject.trim()
      );

      formData.set(
        "body",
        body.trim()
      );

      for (
        const file of
          attachments
      ) {
        formData.append(
          "attachments",
          file
        );
      }

      const response =
        await fetch(
          `/contracts/${contractId}/send`,
          {
            method: "POST",

            headers: {
              "x-dryhome-composer":
                "1",
            },

            body:
              formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "The contract could not be emailed."
        );
      }

      window.location.href =
        `/contracts/${contractId}?sent=1`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The contract could not be emailed."
      );

      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={
          openComposer
        }
        disabled={
          !hasEmail ||
          sending
        }
        className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
          hasEmail &&
          !sending
            ? "bg-slate-900 text-white hover:bg-slate-700"
            : "cursor-not-allowed bg-slate-300 text-slate-500"
        }`}
        title={
          hasEmail
            ? `Send to ${recipient}`
            : "The client does not have an email address"
        }
      >
        {status ===
        "Draft"
          ? "Send Contract"
          : "Send Again"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email Composer
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {status ===
                  "Draft"
                    ? "Send Contract"
                    : "Send Contract Again"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review or edit the email before sending.
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
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-sm text-slate-500">
                Loading email template...
              </div>
            ) : (
              <form
                onSubmit={
                  handleSubmit
                }
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex-1 overflow-y-auto p-6">

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {error}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`contract-email-to-${contractId}`}
                      className="block text-sm font-semibold text-slate-700"
                    >
                      To
                    </label>

                    <input
                      id={`contract-email-to-${contractId}`}
                      type="email"
                      value={
                        emailTo
                      }
                      onChange={(
                        event
                      ) =>
                        setEmailTo(
                          event.target.value
                        )
                      }
                      disabled={
                        sending
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Changing this address only affects this email. It does not change the client record.
                    </p>
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor={`contract-email-subject-${contractId}`}
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Subject
                    </label>

                    <input
                      id={`contract-email-subject-${contractId}`}
                      type="text"
                      value={
                        subject
                      }
                      onChange={(
                        event
                      ) =>
                        setSubject(
                          event.target.value
                        )
                      }
                      disabled={
                        sending
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor={`contract-email-body-${contractId}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Email Message
                      </label>

                      <button
                        type="button"
                        onClick={
                          resetTemplate
                        }
                        disabled={
                          sending
                        }
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Reset to Template
                      </button>
                    </div>

                    <textarea
                      id={`contract-email-body-${contractId}`}
                      value={
                        body
                      }
                      onChange={(
                        event
                      ) =>
                        setBody(
                          event.target.value
                        )
                      }
                      disabled={
                        sending
                      }
                      rows={14}
                      className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-slate-500"
                    />

                    <div className="mt-2 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                      The secure{" "}
                      <strong className="text-slate-700">
                        View &amp; Sign Contract
                      </strong>{" "}
                      button and contract summary are added automatically.
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Attachments
                    </h3>

                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                      <p className="text-sm font-semibold text-blue-900">
                        Secure Contract Link
                      </p>

                      <p className="mt-1 text-xs leading-5 text-blue-700">
                        The secure View &amp; Sign Contract button is automatically included in the email.
                      </p>
                    </div>

                    {attachments.length >
                      0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map(
                          (
                            file,
                            index
                          ) => (
                            <div
                              key={`${file.name}-${file.size}-${index}`}
                              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
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
                                disabled={
                                  sending
                                }
                                className="text-xs font-semibold text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        + Add Attachment

                        <input
                          type="file"
                          multiple
                          onChange={
                            handleAttachments
                          }
                          disabled={
                            sending
                          }
                          className="hidden"
                        />
                      </label>

                      <p className="mt-2 text-xs text-slate-400">
                        Up to 5 additional files, maximum 4 MB combined.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={
                      closeComposer
                    }
                    disabled={
                      sending
                    }
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      sending
                    }
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {sending
                      ? "Sending..."
                      : "Send Contract"}
                  </button>
                </div>
              </form>
            )}
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
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}