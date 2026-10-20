import { STATUS_STYLES, statusLabel } from "@/lib/staff";
import { BRAND_STATUS } from "@/app/staff/brand";
import type { EmployeeSession } from "@/lib/staff-auth";

export function StaffUnavailable({ status }: { status: Exclude<EmployeeSession["status"], "ok"> }) {
  const message =
    status === "not-set-up"
      ? "The staff portal isn't set up yet – the office needs to run supabase/staff_portal.sql."
      : status === "inactive"
        ? "Your staff account has been deactivated. Please speak to the office."
        : "We couldn't find your staff record. Please speak to the office.";
  return <div className="rounded-2xl border-l-4 border-[#f29e23] bg-white p-5 text-sm text-[#252525] shadow-sm">{message}</div>;
}

export function Flash({ error, saved }: { error?: string; saved?: string }) {
  if (error) {
    return <div className="mb-4 rounded-xl border-l-4 border-[#be1e2d] bg-white p-3 text-sm font-medium text-[#be1e2d] shadow-sm">{error}</div>;
  }
  if (saved) {
    const text: Record<string, string> = {
      entry: "Saved.",
      removed: "Entry removed.",
      cleared: "Day cleared.",
      submitted: "Week submitted for approval.",
      requested: "Holiday request sent.",
      cancelled: "Request cancelled.",
    };
    return (
      <div className="mb-4 rounded-xl border-l-4 border-[#252525] bg-white p-3 text-sm font-medium text-[#252525] shadow-sm">
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

/** Staff-portal badge in brand colours (the office Staff page keeps StatusPill). */
export function BrandStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${BRAND_STATUS[status] ?? BRAND_STATUS.draft}`}>
      {statusLabel(status)}
    </span>
  );
}
