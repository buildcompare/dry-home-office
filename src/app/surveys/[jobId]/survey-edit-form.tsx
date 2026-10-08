"use client";

import { useActionState, useState } from "react";

import { updateSurvey } from "../actions";
import {
  DEFAULT_SURVEY_MINUTES,
  addMinutesToTime,
  type UpdateSurveyState,
} from "@/lib/survey";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500";

export type SurveyEditValues = {
  jobId: string;
  surveyDate: string;
  startTime: string;
  endTime: string;
  hasEvent: boolean;
  allDay: boolean;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  fee: string;
  feeLock: string | null;
  notes: string;
};

const initialState: UpdateSurveyState = { error: null };

export default function SurveyEditForm({ values }: { values: SurveyEditValues }) {
  const [state, formAction, pending] = useActionState(updateSurvey, initialState);
  const [form, setForm] = useState(values);
  const [endEdited, setEndEdited] = useState(Boolean(values.endTime));

  function set<K extends keyof SurveyEditValues>(key: K, value: SurveyEditValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="job_id" value={values.jobId} />

      {state.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <Field label="Survey date" required>
            <input
              id="survey_date"
              name="survey_date"
              type="date"
              required
              value={form.surveyDate}
              onChange={(event) => set("surveyDate", event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {values.hasEvent && (
          <>
            <Field label="Start time" required={!values.allDay}>
              <input
                name="start_time"
                type="time"
                required={!values.allDay}
                value={form.startTime}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    startTime: value,
                    endTime: endEdited
                      ? current.endTime
                      : addMinutesToTime(value, DEFAULT_SURVEY_MINUTES),
                  }));
                }}
                className={inputClass}
              />
            </Field>
            <Field label="End time" required={!values.allDay || Boolean(form.startTime)}>
              <input
                name="end_time"
                type="time"
                required={!values.allDay || Boolean(form.startTime)}
                value={form.endTime}
                onChange={(event) => {
                  setEndEdited(true);
                  set("endTime", event.target.value);
                }}
                className={inputClass}
              />
            </Field>
          </>
        )}
      </div>

      {values.hasEvent ? (
        <p className="text-xs text-slate-500">
          {values.allDay
            ? "This is an all-day appointment. Add a start and end time to give it a time."
            : "Saving moves the Schedule appointment (and Google Calendar) too."}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          This survey is not on the Schedule. Use “Add to Schedule” to give it a time.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Site address line 1">
            <TextInput name="site_address_line_1" value={form.addressLine1} onChange={(v) => set("addressLine1", v)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Address line 2">
            <TextInput name="site_address_line_2" value={form.addressLine2} onChange={(v) => set("addressLine2", v)} />
          </Field>
        </div>
        <Field label="Town">
          <TextInput name="site_town" value={form.town} onChange={(v) => set("town", v)} />
        </Field>
        <Field label="County">
          <TextInput name="site_county" value={form.county} onChange={(v) => set("county", v)} />
        </Field>
        <Field label="Postcode">
          <TextInput name="site_postcode" spellCheck={false} value={form.postcode} onChange={(v) => set("postcode", v)} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Survey fee (£)" required={!values.feeLock}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">£</span>
            <input
              name="survey_fee"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required={!values.feeLock}
              disabled={Boolean(values.feeLock)}
              value={form.fee}
              onChange={(event) => set("fee", event.target.value)}
              className={`${inputClass} pl-8`}
            />
          </div>
        </Field>
        {values.feeLock && (
          <p className="self-end pb-3 text-sm text-slate-500 md:col-span-2">{values.feeLock}</p>
        )}
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          spellCheck
          rows={4}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  name,
  value,
  onChange,
  spellCheck = true,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  spellCheck?: boolean;
}) {
  return (
    <input
      name={name}
      type="text"
      spellCheck={spellCheck}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}
