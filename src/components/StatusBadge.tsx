export default function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Accepted" ||
    status === "Paid" ||
    status === "Signed" ||
    status === "Complete" ||
    status === "Completed" ||
    status === "Issued"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Draft"
        ? "bg-slate-100 text-slate-700"
        : status === "Sent" ||
            status === "Viewed" ||
            status === "Scheduled" ||
            status === "Survey" ||
            status === "Survey Booked" ||
            status === "Work" ||
            status === "In Progress"
          ? "bg-blue-100 text-blue-800"
          : status === "Cancelled" ||
              status === "Declined" ||
              status === "Overdue"
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}
