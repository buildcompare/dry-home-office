import Sidebar from "@/components/Sidebar";

/** Skeleton shown instantly while an office page loads its data. */
export function SkeletonBlocks({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-200" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 rounded-xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

export default function OfficePageLoading() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:p-8" aria-busy="true">
        <div className="mx-auto max-w-5xl">
          <span className="sr-only">Loading…</span>
          <SkeletonBlocks />
        </div>
      </main>
    </div>
  );
}
