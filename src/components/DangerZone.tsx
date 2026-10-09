import type { DeleteKind } from "@/lib/delete-preview";
import DeleteRecordButton from "@/components/DeleteRecordButton";

/**
 * Bottom-of-page delete area, kept apart from the main actions.
 */
export default function DangerZone({
  kind,
  id,
  label,
  description,
  className = "mt-10",
}: {
  kind: DeleteKind;
  id: string;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <section className={`${className} flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-white px-6 py-5`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <DeleteRecordButton kind={kind} id={id} label={label} />
    </section>
  );
}
