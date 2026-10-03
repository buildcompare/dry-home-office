import Sidebar from "@/components/Sidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCalendarFeeds } from "./actions";

type CalendarSettingsPageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

const setupSql = `-- Secret Google Calendar iCal links.
-- office_settings is readable by every signed-in user, so these URLs
-- must not be added there. This table has row level security and no
-- policy for anon or authenticated. Only the service role can read it.

create table if not exists public.office_calendar_feeds (
  id integer primary key default 1,
  work_ics_url text,
  family_ics_url text,
  constraint office_calendar_feeds_singleton check (id = 1)
);

alter table public.office_calendar_feeds enable row level security;

revoke all on table public.office_calendar_feeds from anon, authenticated;
grant select, insert, update, delete on table public.office_calendar_feeds to service_role;

insert into public.office_calendar_feeds (id)
values (1)
on conflict (id) do nothing;`;

export default async function CalendarSettingsPage({
  searchParams,
}: CalendarSettingsPageProps) {
  const params = await searchParams;
  const workFromEnv = Boolean(process.env.GOOGLE_CALENDAR_ICS_URL?.trim());
  const familyFromEnv = Boolean(process.env.GOOGLE_FAMILY_CALENDAR_ICS_URL?.trim());

  let state: "ready" | "key" | "table" = "ready";
  let workSaved = false;
  let familySaved = false;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("office_calendar_feeds")
      .select("work_ics_url, family_ics_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      state = "table";
    } else {
      workSaved = typeof data?.work_ics_url === "string" && data.work_ics_url.trim() !== "";
      familySaved = typeof data?.family_ics_url === "string" && data.family_ics_url.trim() !== "";
    }
  } catch {
    state = "key";
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-slate-500">Settings</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-2 text-slate-500">
            Show events from Google Calendar on the office schedule. Events are
            read when the schedule opens. They are not saved as jobs, clients,
            or appointments.
          </p>

          {params.saved ? (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Calendar links saved.
            </p>
          ) : null}

          {params.error === "invalid" ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Use a Google Calendar secret iCal address. It starts with
              https://calendar.google.com/calendar/ical/ and ends with .ics.
            </p>
          ) : null}

          {params.error === "save" ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              The calendar link could not be saved.
            </p>
          ) : null}

          {state === "key" ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-950">Server key required</h2>
              <p className="mt-2 text-sm text-amber-900">
                Saving links needs the service role key on the server. Until then,
                Schedule can still read GOOGLE_CALENDAR_ICS_URL and
                GOOGLE_FAMILY_CALENDAR_ICS_URL if those are set.
              </p>
            </section>
          ) : null}

          {state === "table" || params.error === "setup" ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-950">One-time setup</h2>
              <p className="mt-2 text-sm text-amber-900">
                Run this in the Supabase SQL editor, then refresh. The links are
                not stored on the numbering settings row, because that row can be
                read from the browser.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {setupSql}
              </pre>
            </section>
          ) : null}

          {state === "ready" ? (
            <form action={saveCalendarFeeds} className="mt-8 space-y-6 rounded-2xl bg-white p-6 shadow-sm">
              <FeedField
                label="Work calendar"
                name="work_ics_url"
                clearName="clear_work"
                saved={workSaved}
                fromEnv={workFromEnv}
              />
              <FeedField
                label="Family calendar"
                name="family_ics_url"
                clearName="clear_family"
                saved={familySaved}
                fromEnv={familyFromEnv}
              />
              <p className="text-sm text-slate-500">
                In Google Calendar, open Settings for the calendar, then Integrate
                calendar, and copy the secret address in iCal format. Leave a box
                blank to keep the saved link. The address is not shown again.
              </p>
              <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                Save calendar links
              </button>
            </form>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function FeedField({
  label,
  name,
  clearName,
  saved,
  fromEnv,
}: {
  label: string;
  name: string;
  clearName: string;
  saved: boolean;
  fromEnv: boolean;
}) {
  return (
    <fieldset className="space-y-3 border-b border-slate-100 pb-6">
      <legend className="font-semibold text-slate-900">{label}</legend>
      <label className="block text-sm text-slate-600">
        Secret iCal address
        <input
          name={name}
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          placeholder={
            saved
              ? "A link is saved. Paste a new one to replace it."
              : "https://calendar.google.com/calendar/ical/..."
          }
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
        />
      </label>
      {saved ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input name={clearName} type="checkbox" className="h-4 w-4" />
          Remove the saved link
        </label>
      ) : null}
      {fromEnv ? (
        <p className="text-sm text-slate-500">
          A link is also set in the server environment. It is used only when no
          link is saved here.
        </p>
      ) : null}
      {saved ? <p className="text-sm text-slate-500">A link is saved on the server.</p> : null}
    </fieldset>
  );
}
