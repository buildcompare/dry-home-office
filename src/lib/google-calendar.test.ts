import assert from "node:assert/strict";
import { eventsFromIcs, isAllowedCalendarUrl } from "./google-calendar";

const october = { start: "2026-10-01", end: "2026-10-31" };

function titles(ics: string, range = october) {
  return eventsFromIcs(ics, range, "Work").map((event) => ({
    title: event.title,
    start: event.start_date,
    end: event.end_date,
    time: event.start_time,
    endTime: event.end_time,
    allDay: event.all_day,
    type: event.event_type,
    label: event.google_label,
  }));
}

function wrap(body: string) {
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR\n`;
}

const allDay = titles(wrap(`
BEGIN:VEVENT
UID:allday
SUMMARY:Site visit
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261006
END:VEVENT
`));
assert.deepEqual(allDay, [{
  title: "Site visit",
  start: "2026-10-03",
  end: "2026-10-05",
  time: null,
  endTime: null,
  allDay: true,
  type: "Other",
  label: "Google",
}]);

const bst = titles(wrap(`
BEGIN:VEVENT
UID:bst
SUMMARY:UTC morning
DTSTART:20261003T090000Z
DTEND:20261003T100000Z
END:VEVENT
`));
assert.equal(bst[0].time, "10:00");
assert.equal(bst[0].start, "2026-10-03");

const gmt = titles(wrap(`
BEGIN:VEVENT
UID:gmt
SUMMARY:January
DTSTART:20260115T090000Z
DTEND:20260115T100000Z
END:VEVENT
`), { start: "2026-01-01", end: "2026-01-31" });
assert.equal(gmt[0].time, "09:00");
assert.equal(gmt[0].start, "2026-01-15");

const london = titles(wrap(`
BEGIN:VEVENT
UID:london
SUMMARY:Local
DTSTART;TZID=Europe/London:20261003T090000
DTEND;TZID=Europe/London:20261003T103000
END:VEVENT
`));
assert.equal(london[0].time, "09:00");
assert.equal(london[0].endTime, "10:30");

const late = titles(wrap(`
BEGIN:VEVENT
UID:late
SUMMARY:After midnight
DTSTART:20261003T233000Z
DTEND:20261004T003000Z
END:VEVENT
`));
assert.equal(late[0].start, "2026-10-04");
assert.equal(late[0].time, "00:30");

const midnightEnd = titles(wrap(`
BEGIN:VEVENT
UID:mid
SUMMARY:Until midnight
DTSTART;TZID=Europe/London:20261003T220000
DTEND;TZID=Europe/London:20261004T000000
END:VEVENT
`));
assert.equal(midnightEnd[0].start, "2026-10-03");
assert.equal(midnightEnd[0].end, "2026-10-03");
assert.equal(midnightEnd[0].time, "22:00");

const crosses = titles(wrap(`
BEGIN:VEVENT
UID:cross
SUMMARY:Night
DTSTART;TZID=Europe/London:20261003T220000
DTEND;TZID=Europe/London:20261004T010000
END:VEVENT
`));
assert.equal(crosses[0].start, "2026-10-03");
assert.equal(crosses[0].end, "2026-10-04");
assert.equal(crosses[0].endTime, "01:00");

const cancelled = titles(wrap(`
BEGIN:VEVENT
UID:gone
SUMMARY:Cancelled
STATUS:CANCELLED
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
END:VEVENT
`));
assert.equal(cancelled.length, 0);

const weekly = titles(wrap(`
BEGIN:VEVENT
UID:weekly
SUMMARY:Standup
DTSTART;TZID=Europe/London:20261005T090000
DTEND;TZID=Europe/London:20261005T093000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(weekly, [
  "2026-10-05",
  "2026-10-07",
  "2026-10-12",
  "2026-10-14",
  "2026-10-19",
  "2026-10-21",
  "2026-10-26",
  "2026-10-28",
]);

const fortnight = titles(wrap(`
BEGIN:VEVENT
UID:fortnight
SUMMARY:Pay
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(fortnight, ["2026-10-05", "2026-10-19"]);

const excluded = titles(wrap(`
BEGIN:VEVENT
UID:ex
SUMMARY:Class
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE;VALUE=DATE:20261012
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(excluded, ["2026-10-05", "2026-10-19", "2026-10-26"]);

const counted = titles(wrap(`
BEGIN:VEVENT
UID:count
SUMMARY:Three
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(counted, ["2026-10-05", "2026-10-12"]);

const until = titles(wrap(`
BEGIN:VEVENT
UID:until
SUMMARY:Until
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261012
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(until, ["2026-10-05", "2026-10-12"]);

const birthday = titles(wrap(`
BEGIN:VEVENT
UID:bday
SUMMARY:Birthday
DTSTART;VALUE=DATE:19900315
DTEND;VALUE=DATE:19900316
RRULE:FREQ=YEARLY
END:VEVENT
`), { start: "2026-03-01", end: "2026-03-31" });
assert.equal(birthday.length, 1);
assert.equal(birthday[0].start, "2026-03-15");
assert.equal(birthday[0].allDay, true);

const monthly = titles(wrap(`
BEGIN:VEVENT
UID:month
SUMMARY:Invoice
DTSTART;VALUE=DATE:20260115
DTEND;VALUE=DATE:20260116
RRULE:FREQ=MONTHLY
END:VEVENT
`));
assert.deepEqual(monthly.map((event) => event.start), ["2026-10-15"]);

const firstMonday = titles(wrap(`
BEGIN:VEVENT
UID:first
SUMMARY:Board
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=MONTHLY;BYDAY=1MO
END:VEVENT
`));
assert.deepEqual(firstMonday.map((event) => event.start), ["2026-10-05"]);

const folded = titles(wrap("BEGIN:VEVENT\nUID:fold\nSUMMARY:Hello\n world\nDTSTART;VALUE=DATE:20261003\nDTEND;VALUE=DATE:20261004\nEND:VEVENT"));
assert.equal(folded[0].title, "Helloworld");

const escaped = titles(wrap(`
BEGIN:VEVENT
UID:esc
SUMMARY:Smith\\, Jane
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
END:VEVENT
`));
assert.equal(escaped[0].title, "Smith, Jane");

const moved = titles(wrap(`
BEGIN:VEVENT
UID:series
SUMMARY:Weekly
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
BEGIN:VEVENT
UID:series
SUMMARY:Moved visit
RECURRENCE-ID;VALUE=DATE:20261012
DTSTART;VALUE=DATE:20261013
DTEND;VALUE=DATE:20261014
END:VEVENT
`));
assert.deepEqual(moved.map((event) => [event.start, event.title]), [
  ["2026-10-05", "Weekly"],
  ["2026-10-13", "Moved visit"],
  ["2026-10-19", "Weekly"],
  ["2026-10-26", "Weekly"],
]);

const dst = titles(wrap(`
BEGIN:VEVENT
UID:dst
SUMMARY:Clinic
DTSTART;TZID=Europe/London:20261019T093000
DTEND;TZID=Europe/London:20261019T103000
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
`)).filter((event) => event.start === "2026-10-19" || event.start === "2026-10-26");
assert.deepEqual(dst.map((event) => [event.start, event.time]), [
  ["2026-10-19", "09:30"],
  ["2026-10-26", "09:30"],
]);

const leap = titles(wrap(`
BEGIN:VEVENT
UID:leap
SUMMARY:Leap
DTSTART;VALUE=DATE:20240229
DTEND;VALUE=DATE:20240301
RRULE:FREQ=YEARLY
END:VEVENT
`), { start: "2026-02-01", end: "2026-02-28" });
assert.equal(leap.length, 0);
const leapOn = titles(wrap(`
BEGIN:VEVENT
UID:leap
SUMMARY:Leap
DTSTART;VALUE=DATE:20240229
DTEND;VALUE=DATE:20240301
RRULE:FREQ=YEARLY
END:VEVENT
`), { start: "2028-02-01", end: "2028-02-29" });
assert.equal(leapOn[0]?.start, "2028-02-29");

const unsupported = titles(wrap(`
BEGIN:VEVENT
UID:bad
SUMMARY:Hourly
DTSTART;TZID=Europe/London:20261003T090000
DTEND;TZID=Europe/London:20261003T100000
RRULE:FREQ=WEEKLY;BYDAY=MO;BYSETPOS=1
END:VEVENT
BEGIN:VEVENT
UID:ok
SUMMARY:Plain
DTSTART;VALUE=DATE:20261008
DTEND;VALUE=DATE:20261009
END:VEVENT
`));
assert.deepEqual(unsupported.map((event) => event.title), ["Plain"]);

assert.equal(titles("not a calendar").length, 0);

const outside = titles(wrap(`
BEGIN:VEVENT
UID:out
SUMMARY:November
DTSTART;VALUE=DATE:20261102
DTEND;VALUE=DATE:20261103
END:VEVENT
`));
assert.equal(outside.length, 0);

const family = eventsFromIcs(wrap(`
BEGIN:VEVENT
UID:fam
SUMMARY:School
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
END:VEVENT
`), october, "Family");
assert.equal(family[0].event_type, "Other");
assert.equal(family[0].google_label, "Google Family");
assert.equal(family[0].google_event_id, "fam");
assert.equal(family[0].source, "google");
assert.equal(family[0].jobs, null);

assert.equal(isAllowedCalendarUrl("https://calendar.google.com/calendar/ical/example%40outlook.com/private-token/basic.ics"), true);
assert.equal(isAllowedCalendarUrl("https://calendar.google.com/calendar/ical/example%40outlook.com/public/basic.ics"), true);
assert.equal(isAllowedCalendarUrl("http://calendar.google.com/calendar/ical/example/basic.ics"), false);
assert.equal(isAllowedCalendarUrl("https://evil.example/calendar/ical/example/basic.ics"), false);
assert.equal(isAllowedCalendarUrl("https://calendar.google.com.evil.com/calendar/ical/example/basic.ics"), false);
assert.equal(isAllowedCalendarUrl("https://user:pass@calendar.google.com/calendar/ical/example/basic.ics"), false);

const timedEx = titles(wrap(`
BEGIN:VEVENT
UID:tex
SUMMARY:Lesson
DTSTART;TZID=Europe/London:20261005T090000
DTEND;TZID=Europe/London:20261005T100000
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE;TZID=Europe/London:20261012T090000
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(timedEx, ["2026-10-05", "2026-10-19", "2026-10-26"]);

const cancelledInstance = titles(wrap(`
BEGIN:VEVENT
UID:dropone
SUMMARY:Round
DTSTART;VALUE=DATE:20261005
DTEND;VALUE=DATE:20261006
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
BEGIN:VEVENT
UID:dropone
SUMMARY:Round
STATUS:CANCELLED
RECURRENCE-ID;VALUE=DATE:20261019
DTSTART;VALUE=DATE:20261019
DTEND;VALUE=DATE:20261020
END:VEVENT
`)).map((event) => event.start);
assert.deepEqual(cancelledInstance, ["2026-10-05", "2026-10-12", "2026-10-26"]);

console.log("ok");
