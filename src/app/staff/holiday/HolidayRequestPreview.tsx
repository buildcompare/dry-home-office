"use client";

import { useEffect, useRef, useState } from "react";
import { holidayDays } from "@/lib/staff";
import { holidayYearLabel, holidayYearOf, holidayYearRange } from "@/lib/bank-holidays";
import { formatDays } from "@/lib/staff-dashboard";

/**
 * Live day count for the request form (weekdays, minus bank holidays,
 * half day = 0.5) with a warning (not a block) when it exceeds what's left.
 */
export default function HolidayRequestPreview({
  bankHolidays,
  available,
  currentYear,
}: {
  bankHolidays: string[];
  available: number;
  currentYear: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState({ start: "", end: "", half: false });

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const data = new FormData(form);
      setValues({
        start: String(data.get("start_date") ?? ""),
        end: String(data.get("end_date") ?? ""),
        half: data.get("half_day") === "on",
      });
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, []);

  const set = new Set(bankHolidays);
  const start = values.start;
  const end = values.half ? start : values.end || start;
  let message: React.ReactNode = <span className="text-slate-500">Choose dates to see how many days this uses.</span>;
  let warn = false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start) {
    const request = { start_date: start, end_date: end, half_day: values.half };
    const total = holidayDays(request, { bankHolidays: set });
    const range = holidayYearRange(currentYear);
    const thisYear = holidayDays(request, { bankHolidays: set, from: range.start, to: range.end });
    const otherYears = total - thisYear;
    warn = thisYear > available;
    message = (
      <>
        <strong className="text-[#252525]">This request uses {formatDays(total)}</strong>
        <span className="text-slate-500"> (weekdays, bank holidays not counted)</span>
        {otherYears > 0 && holidayYearOf(end) !== currentYear && (
          <span className="block text-slate-500">
            {formatDays(thisYear)} in {holidayYearLabel(currentYear)}, {formatDays(otherYears)} in {holidayYearLabel(holidayYearOf(end))}.
          </span>
        )}
        {total === 0 && <span className="block text-slate-500">Those dates are weekends or bank holidays.</span>}
        {warn && (
          <span className="mt-1 block font-semibold text-[#be1e2d]">
            That&apos;s more than your {formatDays(available)} available for {holidayYearLabel(currentYear)}. You can still send it; the office will decide.
          </span>
        )}
      </>
    );
  }

  return (
    <div
      ref={ref}
      aria-live="polite"
      className={`rounded-xl border-l-4 bg-slate-50 p-3 text-sm sm:col-span-2 ${warn ? "border-[#be1e2d]" : "border-[#f29e23]"}`}
    >
      {message}
    </div>
  );
}
