/* Shown instantly inside the staff header while a portal page loads. */
export default function StaffLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="h-3 w-24 rounded bg-[#f29e23]/40" />
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-24 rounded-2xl bg-white shadow-sm" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-white shadow-sm" />
      <div className="h-40 rounded-2xl bg-white shadow-sm" />
    </div>
  );
}
