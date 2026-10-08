import type { SurveyPaymentState } from "@/lib/survey";

export default function SurveyPaymentBadge({
  state,
  short = false,
}: {
  state: SurveyPaymentState | null;
  short?: boolean;
}) {
  if (!state) {
    return null;
  }

  const label =
    state === "paid"
      ? short ? "Paid" : "Survey – paid"
      : state === "unpaid"
        ? short ? "Unpaid" : "Survey – unpaid"
        : short ? "Draft invoice" : "Survey – draft invoice";

  const classes =
    state === "paid"
      ? "bg-emerald-100 text-emerald-800"
      : state === "unpaid"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
