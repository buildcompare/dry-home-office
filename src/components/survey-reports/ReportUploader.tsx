"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { recordSurveyReportUpload } from "@/app/surveys/report-actions";
import {
  SURVEY_REPORTS_BUCKET,
  SURVEY_REPORTS_NOT_SET_UP,
  SURVEY_REPORT_MAX_BYTES,
  buildReportPath,
  defaultReportTitle,
  formatFileSize,
  isPdfFile,
} from "@/lib/survey-report-shared";

type Pending = {
  key: string;
  file: File;
  title: string;
  state: "ready" | "uploading" | "done" | "error";
  message?: string;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ReportUploader({ jobId }: { jobId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(files: FileList | null) {
    setError(null);
    if (!files || files.length === 0) return;

    const next: Pending[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!isPdfFile(file)) {
        rejected.push(`${file.name} is not a PDF`);
      } else if (file.size > SURVEY_REPORT_MAX_BYTES) {
        rejected.push(`${file.name} is over 25 MB`);
      } else if (file.size === 0) {
        rejected.push(`${file.name} is empty`);
      } else {
        next.push({ key: newId(), file, title: defaultReportTitle(file.name), state: "ready" });
      }
    }

    if (rejected.length > 0) {
      setError(`Skipped: ${rejected.join("; ")}. Only PDF files up to 25 MB can be added.`);
    }

    setItems((current) => [...current.filter((item) => item.state !== "done"), ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function update(key: string, changes: Partial<Pending>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }

  async function uploadAll() {
    const queue = items.filter((item) => item.state === "ready" || item.state === "error");
    if (queue.length === 0) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    let uploaded = 0;

    for (const item of queue) {
      update(item.key, { state: "uploading", message: undefined });

      const path = buildReportPath(jobId, newId(), item.file.name);
      const { error: uploadError } = await supabase.storage
        .from(SURVEY_REPORTS_BUCKET)
        .upload(path, item.file, { contentType: "application/pdf", upsert: false });

      if (uploadError) {
        const text = String(uploadError.message ?? "").toLowerCase();
        const notSetUp = text.includes("bucket not found");
        update(item.key, {
          state: "error",
          message: notSetUp
            ? SURVEY_REPORTS_NOT_SET_UP
            : text.includes("size") || text.includes("too large")
              ? "Over the 25 MB limit."
              : "Upload failed. Please try again.",
        });
        if (notSetUp) break;
        continue;
      }

      const saved = await recordSurveyReportUpload({
        jobId,
        path,
        fileName: item.file.name,
        title: item.title,
      });

      if (!saved.ok) {
        update(item.key, { state: "error", message: saved.error });
        continue;
      }

      uploaded += 1;
      update(item.key, { state: "done", message: "Added" });
    }

    setBusy(false);

    if (uploaded > 0) {
      setItems((current) => current.filter((item) => item.state !== "done"));
      router.refresh();
    }
  }

  const waiting = items.filter((item) => item.state !== "done");

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Add reports</p>
          <p className="text-xs text-slate-500">PDF only, up to 25 MB each. You can choose several.</p>
        </div>
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          Choose PDFs
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy}
            onChange={(event) => choose(event.target.files)}
            className="sr-only"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {waiting.length > 0 && (
        <div className="mt-4 space-y-3">
          {waiting.map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="min-w-0 truncate">
                  {item.file.name} · {formatFileSize(item.file.size)}
                </span>
                {item.state === "ready" && !busy && (
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                    className="font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Remove
                  </button>
                )}
                {item.state === "uploading" && <span className="font-semibold text-slate-700">Uploading…</span>}
              </div>
              <label className="mt-2 block text-xs font-medium text-slate-600">
                Title <span className="font-normal text-slate-400">(optional)</span>
                <input
                  type="text"
                  spellCheck
                  value={item.title}
                  disabled={busy}
                  onChange={(event) => update(item.key, { title: event.target.value })}
                  placeholder={defaultReportTitle(item.file.name)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </label>
              {item.state === "error" && item.message && (
                <p className="mt-2 text-xs font-medium text-red-700">{item.message}</p>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={uploadAll}
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {busy
              ? "Uploading…"
              : waiting.length === 1
                ? "Upload report"
                : `Upload ${waiting.length} reports`}
          </button>
        </div>
      )}
    </div>
  );
}
