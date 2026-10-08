"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { addSurveyToSchedule } from "../actions";
import { DEFAULT_SURVEY_MINUTES, addMinutesToTime } from "@/lib/survey";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-900";

export default function AddToScheduleForm({
  jobId,
  surveyDate,
}: {
  jobId: string;
  surveyDate: string;
}) {
  const [date, setDate] = useState(surveyDate);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [endEdited, setEndEdited] = useState(false);
  const [allDay, setAllDay] = useState(false);

  return (
    <form action={addSurveyToSchedule} className="space-y-3">
      <input type="hidden" name="job_id" value={jobId} />

      <label className="block text-sm font-medium text-slate-700">
        Date
        <input
          name="survey_date"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={`${inputClass} mt-1`}
        />
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Start
            <input
              name="start_time"
              type="time"
              required
              value={start}
              onChange={(event) => {
                setStart(event.target.value);
                if (!endEdited) setEnd(addMinutesToTime(event.target.value, DEFAULT_SURVEY_MINUTES));
              }}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            End
            <input
              name="end_time"
              type="time"
              required
              value={end}
              onChange={(event) => {
                setEnd(event.target.value);
                setEndEdited(true);
              }}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="all_day"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        All day (no time yet)
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add to Schedule"}
    </button>
  );
}
