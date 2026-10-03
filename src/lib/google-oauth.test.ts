import assert from "node:assert/strict";
import {
  DEFAULT_GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REDIRECT_URI,
  calendarsToRead,
  eventIdFromInsertResponse,
  eventsFromListResponse,
  googleAuthUrl,
  googleDeleteSucceeded,
  googleEventBody,
  localGoogleEffect,
  mapGoogleApiEvent,
  planGoogleSync,
  refreshTokenFromTokenResponse,
  writeCalendarId,
} from "./google-oauth";

const authUrl = googleAuthUrl("client-id", "state-value");
assert.equal(authUrl.includes("client_secret"), false);
assert.equal(authUrl.includes("client-id"), true);
assert.equal(authUrl.includes(encodeURIComponent(GOOGLE_CALENDAR_SCOPE)), true);
assert.equal(authUrl.includes(encodeURIComponent(GOOGLE_REDIRECT_URI)), true);
assert.equal(authUrl.includes("access_type=offline"), true);
assert.equal(authUrl.includes("state-value"), true);

assert.equal(DEFAULT_GOOGLE_CALENDAR_ID, "primary");
assert.equal(writeCalendarId(null), "primary");
assert.equal(writeCalendarId(""), "primary");
assert.equal(writeCalendarId("   "), "primary");
assert.equal(writeCalendarId("  cal-id  "), "cal-id");
assert.deepEqual(
  calendarsToRead({
    refreshToken: "refresh-token-value",
    calendarId: null,
    familyCalendarId: null,
  }).map((calendar) => [calendar.id, calendar.label]),
  [["primary", "Work"]]
);
assert.deepEqual(
  calendarsToRead({
    refreshToken: "refresh-token-value",
    calendarId: "  ",
    familyCalendarId: null,
  }).map((calendar) => calendar.id),
  ["primary"]
);
assert.deepEqual(
  calendarsToRead({
    refreshToken: "refresh-token-value",
    calendarId: "work-cal",
    familyCalendarId: "family-cal",
  }).map((calendar) => calendar.id),
  ["work-cal", "family-cal"]
);

assert.equal(refreshTokenFromTokenResponse({ refresh_token: "short" }), null);
assert.equal(
  refreshTokenFromTokenResponse({ refresh_token: "x".repeat(30) }),
  "x".repeat(30)
);
assert.equal(refreshTokenFromTokenResponse({ access_token: "x".repeat(30) }), null);

const allDay = mapGoogleApiEvent(
  {
    id: "all-day",
    status: "confirmed",
    summary: "Site visit",
    location: "Leeds",
    start: { date: "2026-10-03" },
    end: { date: "2026-10-06" },
  },
  "work-cal",
  "Work"
);
assert.equal(allDay?.start_date, "2026-10-03");
assert.equal(allDay?.end_date, "2026-10-05");
assert.equal(allDay?.all_day, true);
assert.equal(allDay?.event_type, "Google");

const timed = mapGoogleApiEvent(
  {
    id: "timed",
    status: "confirmed",
    summary: "UTC morning",
    start: { dateTime: "2026-10-03T09:00:00Z" },
    end: { dateTime: "2026-10-03T10:00:00Z" },
  },
  "work-cal",
  "Work"
);
assert.equal(timed?.start_date, "2026-10-03");
assert.equal(timed?.start_time, "10:00:00");
assert.equal(timed?.end_time, "11:00:00");

const family = mapGoogleApiEvent(
  {
    id: "fam",
    status: "confirmed",
    summary: "School",
    start: { date: "2026-10-03" },
    end: { date: "2026-10-04" },
  },
  "family-cal",
  "Family"
);
assert.equal(family?.event_type, "Google Family");

const body = googleEventBody({
  title: "Survey",
  location: "York",
  notes: "Keys in the box",
  start_date: "2026-10-03",
  end_date: "2026-10-05",
  start_time: null,
  end_time: null,
  all_day: true,
});
assert.deepEqual(body.start, { date: "2026-10-03" });
assert.deepEqual(body.end, { date: "2026-10-06" });
assert.equal(body.description, "Keys in the box");

const timedBody = googleEventBody({
  title: "Visit",
  location: null,
  notes: null,
  start_date: "2026-10-03",
  end_date: "2026-10-03",
  start_time: "09:30",
  end_time: "10:00",
  all_day: false,
});
assert.equal(timedBody.start.dateTime, "2026-10-03T09:30:00");
assert.equal(timedBody.start.timeZone, "Europe/London");
assert.equal(timedBody.end.dateTime, "2026-10-03T10:00:00");

const mirror = mapGoogleApiEvent(
  {
    id: "mirror",
    status: "confirmed",
    summary: "Standup",
    start: { date: "2026-10-05" },
    end: { date: "2026-10-06" },
  },
  "work-cal",
  "Work"
);
const officeLinked = mapGoogleApiEvent(
  {
    id: "linked",
    status: "cancelled",
    summary: "Job visit",
    start: { date: "2026-10-08" },
    end: { date: "2026-10-09" },
  },
  "work-cal",
  "Work"
);
const gone = mapGoogleApiEvent(
  {
    id: "gone",
    status: "cancelled",
    summary: "Old",
    start: { date: "2026-10-09" },
    end: { date: "2026-10-10" },
  },
  "work-cal",
  "Work"
);
if (!mirror || !officeLinked || !gone) {
  throw new Error("expected mapped events");
}

const plan = planGoogleSync(
  [mirror, officeLinked, gone],
  [
    {
      id: "row-linked",
      job_id: "job-1",
      contract_id: null,
      event_type: "Work",
      google_calendar_id: "work-cal",
      google_event_id: "linked",
    },
    {
      id: "row-gone",
      job_id: null,
      contract_id: null,
      event_type: "Google",
      google_calendar_id: "work-cal",
      google_event_id: "gone",
    },
    {
      id: "row-mirror",
      job_id: null,
      contract_id: null,
      event_type: "Google",
      google_calendar_id: "work-cal",
      google_event_id: "mirror",
    },
  ]
);

assert.equal(plan.inserts.length, 0);
assert.deepEqual(
  plan.removals.map((removal) => [removal.id, removal.action]),
  [
    ["row-linked", "cancel"],
    ["row-gone", "delete"],
  ]
);
assert.equal(plan.updates.length, 1);
assert.equal(plan.updates[0].id, "row-mirror");
assert.equal(plan.updates[0].patch.event_type, "Google");

const renamedOffice: typeof mirror = {
  ...mirror,
  google_event_id: "office",
  title: "Renamed on Google",
};
const keepType = planGoogleSync(
  [renamedOffice],
  [
    {
      id: "row-office",
      job_id: null,
      contract_id: "contract-1",
      event_type: "Survey",
      google_calendar_id: "work-cal",
      google_event_id: "office",
    },
  ]
);
assert.equal(keepType.updates[0].patch.title, "Renamed on Google");
assert.equal(keepType.updates[0].patch.event_type, undefined);
assert.equal(localGoogleEffect({ job_id: null, contract_id: "c" }), "cancel");
assert.equal(localGoogleEffect({ job_id: null, contract_id: null }), "delete");

assert.equal(googleDeleteSucceeded(204), true);
assert.equal(googleDeleteSucceeded(404), true);
assert.equal(googleDeleteSucceeded(410), true);
assert.equal(googleDeleteSucceeded(500), false);
assert.equal(eventIdFromInsertResponse({ id: "evt_1" }), "evt_1");
assert.deepEqual(eventsFromListResponse({ items: [{ id: "a" }], nextPageToken: "next" }), {
  events: [{ id: "a" }],
  nextPageToken: "next",
});

console.log("ok");
