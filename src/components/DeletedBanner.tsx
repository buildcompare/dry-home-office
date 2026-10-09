/** Green "Deleted …" banner shown on a list page after a delete. */
export default function DeletedBanner({ message, fallback = "Deleted." }: { message?: string | null; fallback?: string }) {
  if (!message) return null;

  const text = message === "1" ? fallback : message.slice(0, 400);

  return (
    <div role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      {text}
    </div>
  );
}
