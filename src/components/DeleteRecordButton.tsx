"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteRecord, previewDelete } from "@/app/actions/delete-records";
import {
  confirmSatisfied,
  type DeleteKind,
  type DeletePreview,
  type DeleteState,
} from "@/lib/delete-preview";

const initialState: DeleteState = { error: null };
const MAX_ITEMS = 8;

/**
 * Red "Delete" button for a record's detail page. Opens a confirm
 * dialog that loads (server-side) exactly what will be deleted, then
 * asks for a tick or typed confirmation when there is linked or paid
 * data. Nothing is deleted until the dialog's own button is pressed.
 */
export default function DeleteRecordButton({
  kind,
  id,
  label = "Delete",
  className,
}: {
  kind: DeleteKind;
  id: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [ticked, setTicked] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState(deleteRecord, initialState);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    previewDelete(kind, id)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview({ ok: false, error: "The delete check failed. Nothing was deleted." });
      });

    return () => {
      cancelled = true;
    };
  }, [open, kind, id]);

  function openDialog() {
    setPreview(null);
    setTicked(false);
    setTyped("");
    setOpen(true);
  }

  const ready = preview?.ok === true && !preview.blocked;
  const confirmed = preview?.ok === true && confirmSatisfied(preview.confirm, { ticked, typed });

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ??
          "rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-400 hover:bg-red-50"
        }
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
            <div className="border-b border-red-100 bg-red-50 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Delete</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {preview?.ok ? preview.heading : "Checking what will be deleted…"}
              </h2>
              {preview?.ok && <p className="mt-2 text-sm text-red-800">{preview.warning}</p>}
            </div>

            <form action={formAction} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="token" value={preview?.ok ? preview.token : ""} />
              <input type="hidden" name="confirm" value={ticked ? "yes" : ""} />

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm text-slate-700">
                {!preview && <p className="text-slate-500">Loading…</p>}

                {preview && !preview.ok && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{preview.error}</div>
                )}

                {state.error && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700">
                    {state.error}
                  </div>
                )}

                {preview?.ok && preview.blocked && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    {preview.blocked}
                  </div>
                )}

                {preview?.ok &&
                  preview.notes.map((note) => (
                    <div key={note} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900">
                      {note}
                    </div>
                  ))}

                {preview?.ok && preview.summary.length > 0 && !preview.blocked && (
                  <div>
                    <p className="font-semibold text-slate-900">This will delete:</p>
                    <ul className="mt-2 space-y-2 rounded-xl border border-slate-200 p-3">
                      {preview.summary.map((group) => (
                        <li key={group.label}>
                          <p className="font-semibold text-slate-800">{group.label}</p>
                          <ul className="mt-0.5 list-disc pl-5 text-slate-600">
                            {group.items.slice(0, MAX_ITEMS).map((item, index) => (
                              <li key={`${item}-${index}`} className="break-words">
                                {item}
                              </li>
                            ))}
                            {group.items.length > MAX_ITEMS && (
                              <li className="list-none text-slate-400">and {group.items.length - MAX_ITEMS} more</li>
                            )}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ready && preview.confirm.mode === "tick" && (
                  <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <input
                      type="checkbox"
                      checked={ticked}
                      onChange={(event) => setTicked(event.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="leading-6 text-red-800">{preview.confirm.label}</span>
                  </label>
                )}

                {ready && preview.confirm.mode === "type" && (
                  <label className="block">
                    <span className="font-semibold text-slate-800">{preview.confirm.label}</span>
                    <input
                      name="confirm_text"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                      placeholder={preview.confirm.text}
                      className="mt-2 w-full rounded-lg border border-red-300 px-4 py-3 text-slate-900 outline-none focus:border-red-600"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                {ready && (
                  <DeleteSubmit disabled={!confirmed} label={preview.submitLabel} />
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function DeleteSubmit({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
