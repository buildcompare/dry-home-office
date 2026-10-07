export default function SurveyPaymentBadge({
  state,
}: {
  state: "paid" | "unpaid" | null;
}) {
  if (!state) {
    return null;
  }

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        state === "paid"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-red-100 text-red-700"
      }`}
    >
      {state === "paid" ? "Survey – paid" : "Survey – unpaid"}
    </span>
  );
}
