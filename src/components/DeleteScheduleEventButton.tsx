"use client";

import { deleteScheduleEvent } from "@/app/schedule/actions";

export default function DeleteScheduleEventButton({
  id,
  title,
  month,
}: {
  id: string;
  title: string;
  month: string;
}) {
  return (
    <form action={deleteScheduleEvent} className="mt-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        className="font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
        onClick={(event) => {
          const confirmed = window.confirm(
            `Delete "${title}"? If it is on Google Calendar, it will be deleted there too.`
          );
          if (!confirmed) event.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
