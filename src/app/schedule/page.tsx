import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DeleteScheduleEventButton from "@/components/DeleteScheduleEventButton";
import { createClient } from "@/lib/supabase/server";
import { loadSurveyInvoicesByJob } from "@/lib/survey-payments";
import {
  SURVEY_EVENT_TYPE,
  surveyPaymentState,
} from "@/lib/survey";
import { loadGoogleScheduleEvents } from "@/lib/calendar-feeds";
import { syncGoogleCalendarMonth } from "@/lib/google-calendar-sync";
import {
  googleDisplayLabel,
  hideIcalDuplicate,
} from "@/lib/google-oauth";

type SchedulePageProps = {
  searchParams: Promise<{
    month?: string;
    error?: string;
    notice?: string;
  }>;
};

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  const params = await searchParams;

  const currentMonth =
    validMonth(params.month) || londonMonthToday();

  const [yearText, monthText] =
    currentMonth.split("-");

  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  const monthStart = `${currentMonth}-01`;

  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();

  const monthEnd =
    `${currentMonth}-${String(daysInMonth).padStart(
      2,
      "0"
    )}`;

  const googleSync = await syncGoogleCalendarMonth(
    monthStart,
    monthEnd
  );

  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("schedule_events")
    .select(`
      id,
      title,
      event_type,
      status,
      start_date,
      end_date,
      start_time,
      end_time,
      all_day,
      location,
      assigned_to,
      client_id,
      job_id,
      contract_id,
      google_calendar_id,
      google_event_id,
      clients (
        id,
        display_name,
        first_name,
        last_name
      ),
      jobs (
        id,
        job_number,
        title,
        job_type
      )
    `)
    .lte("start_date", monthEnd)
    .or(
      `end_date.is.null,end_date.gte.${monthStart}`
    )
    .order("start_date", {
      ascending: true,
    })
    .order("start_time", {
      ascending: true,
    });

  if (error) {
    console.error(error);
  }

  const googleCalendar =
    await loadGoogleScheduleEvents(
      monthStart,
      monthEnd
    );

  const officeEvents = (events ?? [])
    .filter((event) => event.status !== "Cancelled")
    .map((event) => ({
      ...event,
      source: "office" as const,
    }));

  /*
   * Survey appointments whose survey invoice is still unpaid get a
   * small "Unpaid" tag.
   */

  const surveyJobs = officeEvents
    .filter(
      (event) => event.event_type === SURVEY_EVENT_TYPE
    )
    .map((event) =>
      Array.isArray(event.jobs) ? event.jobs[0] : event.jobs
    )
    .filter(
      (job): job is NonNullable<typeof job> => Boolean(job?.id)
    );

  const surveyInvoices = await loadSurveyInvoicesByJob(
    supabase,
    Array.from(new Set(surveyJobs.map((job) => String(job.id))))
  );

  const unpaidSurveyJobIds = new Set(
    surveyJobs
      .filter(
        (job) =>
          surveyPaymentState(
            job,
            surveyInvoices.get(String(job.id)) ?? []
          ) === "unpaid"
      )
      .map((job) => String(job.id))
  );

  const icalEvents = googleCalendar.events.filter(
    (event) => !hideIcalDuplicate(event, googleSync)
  );

  const calendarEvents = [
    ...officeEvents,
    ...icalEvents,
  ];

  const firstDay = new Date(
    Date.UTC(year, monthIndex, 1)
  ).getUTCDay();

  const leadingDays =
    (firstDay + 6) % 7;

  const numberOfCells =
    Math.ceil(
      (leadingDays + daysInMonth) / 7
    ) * 7;

  const cells = Array.from(
    { length: numberOfCells },
    (_, index) => {
      const day =
        index - leadingDays + 1;

      if (
        day < 1 ||
        day > daysInMonth
      ) {
        return null;
      }

      return `${currentMonth}-${String(day).padStart(
        2,
        "0"
      )}`;
    }
  );

  const previousMonth = shiftMonth(
    year,
    monthIndex,
    -1
  );

  const nextMonth = shiftMonth(
    year,
    monthIndex,
    1
  );

  const todayMonth =
    londonMonthToday();

  const monthTitle =
    new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(
      new Date(
        Date.UTC(year, monthIndex, 1)
      )
    );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                DryHome Office
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Schedule
              </h1>

              <p className="mt-2 text-slate-500">
                Surveys, jobs and appointments.
              </p>

              {googleCalendar.warning ? (
                <p className="mt-2 text-sm text-amber-700">
                  A Google calendar could not be read. Office events are still shown.
                </p>
              ) : null}

              {googleSync.warning ? (
                <p className="mt-2 text-sm text-amber-700">
                  Google Calendar could not be synced
                  {googleSync.status !== null ? ` (${googleSync.status})` : ""}. The secret iCal feed is still shown when it is set.
                  {googleSync.reason ? ` ${googleSync.reason}` : ""}
                </p>
              ) : null}

              {params.notice === "google" ? (
                <p className="mt-2 text-sm text-amber-700">
                  The appointment was saved here, but it could not be added to Google Calendar.
                </p>
              ) : null}

              {params.error === "google-delete" ? (
                <p className="mt-2 text-sm text-amber-700">
                  That event is still on Google Calendar, so it was left on the schedule.
                </p>
              ) : null}

              {params.error === "delete" ? (
                <p className="mt-2 text-sm text-amber-700">
                  The appointment could not be removed.
                </p>
              ) : null}
            </div>

            <Link
              href={`/schedule/new?date=${monthStart}`}
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              + Add Job / Event
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="flex gap-2">
                <Link
                  href={`/schedule?month=${previousMonth}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ← Previous
                </Link>

                <Link
                  href={`/schedule?month=${todayMonth}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Today
                </Link>

                <Link
                  href={`/schedule?month=${nextMonth}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Next →
                </Link>
              </div>

              <h2 className="text-xl font-semibold text-slate-900">
                {monthTitle}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <div
                      key={day}
                      className="border-r border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 last:border-r-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {cells.map(
                    (date, index) => {
                      if (!date) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-36 border-b border-r border-slate-200 bg-slate-50/50"
                          />
                        );
                      }

                      const dayEvents =
                        calendarEvents.filter((event) =>
                          occursOnDate(
                            event.start_date,
                            event.end_date,
                            date
                          )
                        );

                      if (googleCalendar.events.length > 0) {
                        dayEvents.sort((a, b) => {
                          if (Boolean(a.all_day) !== Boolean(b.all_day)) {
                            return a.all_day ? -1 : 1;
                          }

                          return String(a.start_time ?? "").localeCompare(
                            String(b.start_time ?? "")
                          );
                        });
                      }

                      const dayNumber =
                        Number(date.slice(-2));

                      const isToday =
                        date === londonDateToday();

                      return (
                        <div
                          key={date}
                          className="min-h-36 border-b border-r border-slate-200 p-2"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={
                                isToday
                                  ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
                                  : "text-sm font-semibold text-slate-700"
                              }
                            >
                              {dayNumber}
                            </span>

                            <Link
                              href={`/schedule/new?date=${date}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                            >
                              +
                            </Link>
                          </div>

                          <div className="space-y-2">
                            {dayEvents.map(
                              (event) => {
                                const clientData =
                                  Array.isArray(event.clients)
                                    ? event.clients[0]
                                    : event.clients;

                                const jobData =
                                  Array.isArray(event.jobs)
                                    ? event.jobs[0]
                                    : event.jobs;

                                const clientName =
                                  clientData?.display_name ||
                                  [
                                    clientData?.first_name,
                                    clientData?.last_name,
                                  ]
                                    .filter(Boolean)
                                    .join(" ");

                                const googleLabel = googleDisplayLabel(
                                  {
                                    source: event.source,
                                    event_type: event.event_type,
                                    google_label:
                                      "google_label" in event
                                        ? event.google_label
                                        : null,
                                    google_event_id:
                                      "google_event_id" in event
                                        ? event.google_event_id
                                        : null,
                                    google_calendar_id:
                                      "google_calendar_id" in event
                                        ? event.google_calendar_id
                                        : null,
                                    job_id:
                                      "job_id" in event ? event.job_id : null,
                                    client_id:
                                      "client_id" in event
                                        ? event.client_id
                                        : null,
                                    contract_id:
                                      "contract_id" in event
                                        ? event.contract_id
                                        : null,
                                  },
                                  googleSync.familyCalendarId
                                );

                                return (
                                  <div
                                    key={event.id}
                                    className={`rounded-lg border px-2.5 py-2 text-xs ${eventClass(
                                      event.event_type,
                                      googleLabel
                                    )}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-semibold">
                                        {event.title}
                                      </p>

                                      <span className="whitespace-nowrap font-medium">
                                        {event.all_day
                                          ? "All day"
                                          : formatTime(
                                              event.start_time
                                            )}
                                      </span>
                                    </div>

                                    {event.source === "office" &&
                                      event.event_type === SURVEY_EVENT_TYPE &&
                                      jobData?.id &&
                                      unpaidSurveyJobIds.has(String(jobData.id)) && (
                                        <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                                          Unpaid
                                        </span>
                                      )}

                                    {jobData?.id &&
                                      jobData?.job_number && (
                                        <Link
                                          href={`/jobs/${jobData.id}`}
                                          className="mt-1 inline-block font-semibold underline underline-offset-2"
                                        >
                                          {jobData.job_number}
                                        </Link>
                                      )}

                                    {clientName && (
                                      <p className="mt-1 opacity-75">
                                        {clientName}
                                      </p>
                                    )}

                                    {event.location && (
                                      <p className="mt-1 truncate opacity-70">
                                        {event.location}
                                      </p>
                                    )}

                                    {googleLabel && (
                                        <p className="mt-1 font-semibold uppercase tracking-wide opacity-70">
                                          {googleLabel === "Google Family"
                                            ? "Google · Family"
                                            : "Google"}
                                        </p>
                                      )}

                                    {event.source === "office" ? (
                                      <DeleteScheduleEventButton
                                        id={String(event.id)}
                                        title={event.title}
                                        month={currentMonth}
                                      />
                                    ) : null}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function occursOnDate(
  startDate: string,
  endDate: string | null,
  date: string
) {
  const end =
    endDate || startDate;

  return (
    startDate <= date &&
    end >= date
  );
}

function eventClass(
  type: string,
  googleLabel: "Google" | "Google Family" | null
) {
  if (googleLabel === "Google Family") {
    return "border-rose-200 bg-rose-50 text-rose-950";
  }

  if (googleLabel === "Google") {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }

  switch (type) {
    case "Survey":
      return "border-blue-200 bg-blue-50 text-blue-900";

    case "Work":
      return "border-amber-200 bg-amber-50 text-amber-900";

    case "Return Visit":
      return "border-purple-200 bg-purple-50 text-purple-900";

    case "Follow-up":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";

    case "Google":
      return "border-sky-200 bg-sky-50 text-sky-950";

    case "Google Family":
      return "border-rose-200 bg-rose-50 text-rose-950";

    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

function formatTime(
  value: string | null
) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function validMonth(
  value?: string
) {
  if (
    value &&
    /^\d{4}-\d{2}$/.test(value)
  ) {
    const month =
      Number(value.slice(5, 7));

    if (
      month >= 1 &&
      month <= 12
    ) {
      return value;
    }
  }

  return null;
}

function shiftMonth(
  year: number,
  monthIndex: number,
  amount: number
) {
  const date = new Date(
    Date.UTC(
      year,
      monthIndex + amount,
      1
    )
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function londonMonthToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
    }
  ).format(new Date());
}

function londonDateToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}