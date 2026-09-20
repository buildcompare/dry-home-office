import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  request: Request,
  {
    params,
  }: RouteProps
) {
  const {
    token,
  } = await params;

  const expectedToken =
    process.env
      .DRYHOME_CALENDAR_TOKEN;

  if (
    !expectedToken ||
    token !==
      expectedToken
  ) {
    return new Response(
      "Calendar not found",
      {
        status: 404,
      }
    );
  }

  const supabase =
    createAdminClient();

  const {
    data:
      scheduleEvents,
    error,
  } =
    await supabase
      .from(
        "schedule_events"
      )
      .select(`
        id,
        job_id,
        client_id,
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
        notes,

        jobs (
          id,
          job_number,
          title,
          address_line_1,
          address_line_2,
          town,
          county,
          postcode
        ),

        clients (
          id,
          display_name,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .neq(
        "status",
        "Cancelled"
      )
      .order(
        "start_date",
        {
          ascending:
            true,
        }
      )
      .order(
        "start_time",
        {
          ascending:
            true,
        }
      );

  if (
    error
  ) {
    console.error(
      "Calendar feed error:",
      error
    );

    return new Response(
      "Unable to load calendar",
      {
        status: 500,
      }
    );
  }

  const appUrl =
    (
      process.env
        .NEXT_PUBLIC_APP_URL ||
      new URL(
        request.url
      ).origin
    ).replace(
      /\/$/,
      ""
    );

  const events =
    (
      scheduleEvents ??
      []
    )
      .filter(
        (
          event
        ) =>
          Boolean(
            event.start_date
          )
      )
      .map(
        (
          event
        ) => {
          const job =
            firstRelation(
              event.jobs
            );

          const client =
            firstRelation(
              event.clients
            );

          const clientName =
            client?.display_name ||
            [
              client?.first_name,
              client?.last_name,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              ) ||
            "";

          const jobAddress =
            [
              job?.address_line_1,
              job?.address_line_2,
              job?.town,
              job?.county,
              job?.postcode,
            ]
              .filter(
                Boolean
              )
              .join(
                ", "
              );

          const location =
            event.location?.trim() ||
            jobAddress;

          const summaryParts =
            [
              event.event_type,
              event.title,
            ].filter(
              Boolean
            );

          const summary =
            summaryParts.join(
              " - "
            ) ||
            "DryHome Appointment";

          const descriptionLines =
            [
              job?.job_number
                ? `Job: ${job.job_number}`
                : null,

              clientName
                ? `Client: ${clientName}`
                : null,

              client?.phone
                ? `Phone: ${client.phone}`
                : null,

              event.event_type
                ? `Appointment: ${event.event_type}`
                : null,

              event.assigned_to
                ? `Assigned to: ${event.assigned_to}`
                : null,

              event.notes
                ? `Notes: ${event.notes}`
                : null,

              event.job_id
                ? `Open Job Hub: ${appUrl}/jobs/${event.job_id}`
                : null,
            ].filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                )
            );

          const dateLines =
            makeEventDateLines({
              startDate:
                event.start_date,

              endDate:
                event.end_date,

              startTime:
                event.start_time,

              endTime:
                event.end_time,

              allDay:
                Boolean(
                  event.all_day
                ),
            });

          return [
            "BEGIN:VEVENT",

            `UID:${escapeIcs(
              `${event.id}@dryhome-office`
            )}`,

            `DTSTAMP:${formatUtcDateTime(
              new Date()
            )}`,

            ...dateLines,

            `SUMMARY:${escapeIcs(
              summary
            )}`,

            ...(location
              ? [
                  `LOCATION:${escapeIcs(
                    location
                  )}`,
                ]
              : []),

            ...(descriptionLines.length >
            0
              ? [
                  `DESCRIPTION:${escapeIcs(
                    descriptionLines.join(
                      "\n"
                    )
                  )}`,
                ]
              : []),

            "STATUS:CONFIRMED",

            "END:VEVENT",
          ].join(
            "\r\n"
          );
        }
      );

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DryHome Office//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:DryHome Office",
    "X-WR-TIMEZONE:Europe/London",

    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "X-LIC-LOCATION:Europe/London",

    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "DTSTART:19700329T010000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",

    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "DTSTART:19701025T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",

    "END:VTIMEZONE",

    ...events,

    "END:VCALENDAR",
    "",
  ].join(
    "\r\n"
  );

  return new Response(
    calendar,
    {
      status: 200,

      headers: {
        "Content-Type":
          "text/calendar; charset=utf-8",

        "Content-Disposition":
          'inline; filename="dryhome-office.ics"',

        "Cache-Control":
          "no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

function makeEventDateLines({
  startDate,
  endDate,
  startTime,
  endTime,
  allDay,
}: {
  startDate: string;
  endDate:
    | string
    | null;
  startTime:
    | string
    | null;
  endTime:
    | string
    | null;
  allDay: boolean;
}) {
  const safeEndDate =
    endDate ||
    startDate;

  if (
    allDay ||
    !startTime
  ) {
    return [
      `DTSTART;VALUE=DATE:${formatDateOnly(
        startDate
      )}`,

      /*
       * Calendar DTEND for an all-day event is exclusive.
       * Therefore a one-day appointment ending on 20 Sept
       * uses 21 Sept as DTEND.
       */
      `DTEND;VALUE=DATE:${formatDateOnly(
        addDays(
          safeEndDate,
          1
        )
      )}`,
    ];
  }

  const normalisedStartTime =
    normaliseTime(
      startTime
    );

  const normalisedEndTime =
    normaliseTime(
      endTime ||
        addOneHour(
          startTime
        )
    );

  return [
    `DTSTART;TZID=Europe/London:${formatLocalDateTime(
      startDate,
      normalisedStartTime
    )}`,

    `DTEND;TZID=Europe/London:${formatLocalDateTime(
      safeEndDate,
      normalisedEndTime
    )}`,
  ];
}

function firstRelation<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (
    !value
  ) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}

function formatDateOnly(
  value: string
) {
  return value
    .slice(
      0,
      10
    )
    .replaceAll(
      "-",
      ""
    );
}

function formatLocalDateTime(
  date: string,
  time: string
) {
  return `${formatDateOnly(
    date
  )}T${time.replaceAll(
    ":",
    ""
  )}00`;
}

function formatUtcDateTime(
  date: Date
) {
  return date
    .toISOString()
    .replace(
      /[-:]/g,
      ""
    )
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}

function normaliseTime(
  value: string
) {
  const [
    hours = "00",
    minutes = "00",
  ] =
    value.split(
      ":"
    );

  return `${hours.padStart(
    2,
    "0"
  )}:${minutes.padStart(
    2,
    "0"
  )}`;
}

function addOneHour(
  value: string
) {
  const [
    rawHours,
    rawMinutes,
  ] =
    value
      .split(
        ":"
      )
      .map(
        Number
      );

  const totalMinutes =
    (
      Number.isFinite(
        rawHours
      )
        ? rawHours
        : 0
    ) *
      60 +
    (
      Number.isFinite(
        rawMinutes
      )
        ? rawMinutes
        : 0
    ) +
    60;

  const hours =
    Math.floor(
      totalMinutes /
        60
    ) %
    24;

  const minutes =
    totalMinutes %
    60;

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    minutes
  ).padStart(
    2,
    "0"
  )}`;
}

function addDays(
  dateString: string,
  days: number
) {
  const [
    year,
    month,
    day,
  ] =
    dateString
      .slice(
        0,
        10
      )
      .split(
        "-"
      )
      .map(
        Number
      );

  const date =
    new Date(
      Date.UTC(
        year,
        month -
          1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

function escapeIcs(
  value: string
) {
  return value
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /\r?\n/g,
      "\\n"
    )
    .replace(
      /,/g,
      "\\,"
    )
    .replace(
      /;/g,
      "\\;"
    );
}