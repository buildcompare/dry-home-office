import Link from "next/link";
import {
  activityHref,
  activityTone,
  formatRelativeTime,
  formatUkDateTime,
  TONE_DOT,
  type ActivityItem,
} from "@/lib/activity-shared";

/**
 * A list of activity rows: coloured dot by type, plain sentence,
 * relative time (exact UK time in the tooltip) and a link to the record.
 * Wraps cleanly at 390px.
 */
export default function ActivityList({
  items,
  now = new Date(),
  emptyText = "No activity yet.",
}: {
  items: ActivityItem[];
  now?: Date;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-6">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const href = activityHref(item);
        const exact = formatUkDateTime(item.created_at);

        return (
          <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[activityTone(item.event_type)]}`}
            />

            <div className="min-w-0 flex-1">
              <p className="break-words text-sm text-slate-800">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {item.summary}
                  </Link>
                ) : (
                  item.summary
                )}
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                <time dateTime={item.created_at} title={exact}>
                  {formatRelativeTime(item.created_at, now)}
                </time>
              </p>
            </div>

            {href && (
              <Link
                href={href}
                className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900"
                aria-label={`Open: ${item.summary}`}
              >
                Open →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
