import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type SchedulePageProps = {
  searchParams: Promise<{
    month?: string;
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
      clients (
        id,
        display_name,
        first_name,
        last_name
      ),
      jobs (
        id,
        job_number,
        title
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

  const firstDay = new Date(
    Date.UTC(year, monthIndex, 1)
  ).getUTCDay();

  // Convert Sunday=0 to a Monday-first calendar.
  const leadingDays = (firstDay + 6) % 7;

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

  const todayMonth = londonMonthToday();

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
                Surveys, work and appointments.
              </p>
            </div>

            <Link
              href={`/schedule/new?date=${monthStart}`}
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
            >
              + Add Event
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
                        (events ?? []).filter(
                          (event) =>
                            occursOnDate(
                              event.start_date,
                              event.end_date,
                              date
                            )
                        );

                      const dayNumber =
                        Number(
                          date.slice(-2)
                        );

                      const isToday =
                        date ===
                        londonDateToday();

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
                              title="Add appointment"
                            >
                              +
                            </Link>
                          </div>

                          <div className="space-y-2">
                            {dayEvents.map(
                              (event) => {
                                const clientData =
                                  Array.isArray(
                                    event.clients
                                  )
                                    ? event.clients[0]
                                    : event.clients;

                                const jobData =
                                  Array.isArray(
                                    event.jobs
                                  )
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

                                return (
                                  <div
                                    key={event.id}
                                    className={`rounded-lg border px-2.5 py-2 text-xs ${eventClass(
                                      event.event_type
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

                                    {jobData?.job_number && (
                                      <p className="mt-1 opacity-75">
                                        {
                                          jobData.job_number
                                        }
                                      </p>
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
  const end = endDate || startDate;

  return (
    startDate <= date &&
    end >= date
  );
}

function eventClass(type: string) {
  switch (type) {
    case "Survey":
      return "border-blue-200 bg-blue-50 text-blue-900";

    case "Work":
      return "border-amber-200 bg-amber-50 text-amber-900";

    case "Return Visit":
      return "border-purple-200 bg-purple-50 text-purple-900";

    case "Follow-up":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";

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