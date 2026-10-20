import { STATUS_STYLES, statusLabel } from "@/lib/staff";
import type { EmployeeSession } from "@/lib/staff-auth";

export function StaffUnavailable({ status }: { status: Exclude<EmployeeSession["status"], "ok"> }) {
  const message =
    status === "not-set-up"
      ? "The staff portal isn't set up yet – the office needs to run supabase/staff_portal.sql."
      : status === "inactive"
        ? "Your staff account has been deactivated. Please speak to the office."
        : "We couldn't find your staff record. Please speak to the office.";
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</div>;
}

export function Flash({ error, saved }: { error?: string; saved?: string }) {
  if (error) {
    return <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>;
  }
  if (saved) {
    const text: Record<string, string> = {
      entry: "Saved.",
      removed: "Entry removed.",
      submitted: "Week submitted for approval.",
      requested: "Holiday request sent.",
      cancelled: "Request cancelled.",
    };
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        {text[saved] ?? "Saved."}
      </div>
    );
  }
  return null;
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {statusLabel(status)}
    </span>
  );
}
