/*
 * Friendly Google Calendar sync messages for the Schedule page. The
 * technical detail is only shown inside a small "Details" toggle.
 */

export function reconnectGoogleHref(returnTo: string) {
  return `/api/google/start?return=${encodeURIComponent(returnTo)}`;
}

export default function GoogleSyncBanner({
  sync,
  returnTo,
  justConnected = false,
}: {
  sync: {
    warning: boolean;
    needsReconnect: boolean;
    status: number | null;
    reason: string | null;
    pushed: number;
  };
  returnTo: string;
  justConnected?: boolean;
}) {
  const detail = [sync.status !== null ? `HTTP ${sync.status}` : null, sync.reason]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {justConnected && !sync.needsReconnect ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Google Calendar reconnected.
        </div>
      ) : null}

      {sync.pushed > 0 ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sync.pushed} appointment{sync.pushed === 1 ? "" : "s"} saved while Google was disconnected{" "}
          {sync.pushed === 1 ? "has" : "have"} now been added to Google Calendar.
        </div>
      ) : null}

      {sync.needsReconnect ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">Google Calendar needs reconnecting. Your Google sign-in has expired.</p>
            <p className="mt-1 text-amber-800">
              Office appointments are still saved and shown here. New ones will be added to Google once you
              reconnect.
            </p>
            {detail ? (
              <details className="mt-1 text-xs text-amber-700">
                <summary className="cursor-pointer select-none">Details</summary>
                <p className="mt-1 break-words font-mono">{detail}</p>
              </details>
            ) : null}
          </div>

          <a
            href={reconnectGoogleHref(returnTo)}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-700"
          >
            Reconnect Google
          </a>
        </div>
      ) : sync.warning ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>Google Calendar couldn&apos;t be synced just now. Office appointments are still shown.</p>
          {detail ? (
            <details className="mt-1 text-xs text-amber-700">
              <summary className="cursor-pointer select-none">Details</summary>
              <p className="mt-1 break-words font-mono">{detail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
