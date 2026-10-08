"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createScheduleEventWithGoogle,
  removeScheduleEvent,
} from "@/lib/schedule-create";


export async function addScheduleEvent(
  formData: FormData
) {
  const supabase =
    await createClient();

  const jobId =
    String(
      formData.get("job_id") ?? ""
    ).trim() || null;

  const contractId =
    String(
      formData.get("contract_id") ?? ""
    ).trim() || null;

  let clientId =
    String(
      formData.get("client_id") ?? ""
    ).trim() || null;

  const title =
    String(
      formData.get("title") ?? ""
    ).trim();

  const eventType =
    String(
      formData.get("event_type") ??
        "Other"
    );

  const status =
    String(
      formData.get("status") ??
        "Scheduled"
    );

  const startDate =
    String(
      formData.get("start_date") ?? ""
    );

  const endDate =
    String(
      formData.get("end_date") ?? ""
    ) || startDate;

  const allDay =
    formData.get("all_day") ===
    "on";

  const startTime =
    allDay
      ? null
      : String(
          formData.get(
            "start_time"
          ) ?? ""
        ) || null;

  const endTime =
    allDay
      ? null
      : String(
          formData.get(
            "end_time"
          ) ?? ""
        ) || null;

  let location =
    String(
      formData.get("location") ?? ""
    ).trim() || null;

  if (
    !title ||
    !startDate
  ) {
    redirect(
      `/schedule/new?date=${startDate}&error=Title%20and%20start%20date%20are%20required`
    );
  }

  if (
    endDate <
    startDate
  ) {
    redirect(
      `/schedule/new?date=${startDate}&error=End%20date%20cannot%20be%20before%20start%20date`
    );
  }

  /*
   * If a contract is linked, use it
   * to confirm the correct client.
   */
  if (contractId) {
    const {
      data: contract,
      error: contractError,
    } = await supabase
      .from("contracts")
      .select(`
        id,
        client_id,
        job_id
      `)
      .eq(
        "id",
        contractId
      )
      .single();

    if (
      contractError ||
      !contract
    ) {
      console.error(
        contractError
      );

      redirect(
        `/schedule/new?date=${startDate}&error=Could%20not%20find%20the%20selected%20contract`
      );
    }

    clientId =
      contract.client_id;
  }

  /*
   * If a job is selected, trust
   * the job for client/address.
   */
  if (jobId) {
    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(`
        id,
        client_id,
        job_number,
        title,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      `)
      .eq(
        "id",
        jobId
      )
      .single();

    if (
      jobError ||
      !job
    ) {
      console.error(
        jobError
      );

      redirect(
        `/schedule/new?date=${startDate}&error=Could%20not%20find%20the%20selected%20job`
      );
    }

    clientId =
      job.client_id;

    if (!location) {
      location = [
        job.address_line_1,
        job.address_line_2,
        job.town,
        job.county,
        job.postcode,
      ]
        .filter(Boolean)
        .join(", ");
    }
  }

  const notes =
    String(
      formData.get("notes") ?? ""
    ).trim() || null;

  const created =
    await createScheduleEventWithGoogle(
      supabase,
      {
        job_id:
          jobId,

        contract_id:
          contractId,

        client_id:
          clientId,

        title,

        event_type:
          eventType,

        status,

        start_date:
          startDate,

        end_date:
          endDate,

        start_time:
          startTime,

        end_time:
          endTime,

        all_day:
          allDay,

        location,

        assigned_to:
          String(
            formData.get(
              "assigned_to"
            ) ?? ""
          ).trim() || null,

        notes,
      }
    );

  if (
    !created.ok
  ) {
    redirect(
      `/schedule/new?date=${startDate}&error=Unable%20to%20save%20appointment`
    );
  }

  revalidatePath(
    "/schedule"
  );

  revalidatePath(
    "/jobs"
  );

  revalidatePath(
    "/contracts"
  );

  if (jobId) {
    revalidatePath(
      `/jobs/${jobId}`
    );
  }

  if (clientId) {
    revalidatePath(
      `/clients/${clientId}`
    );
  }

  if (contractId) {
    revalidatePath(
      `/contracts/${contractId}`
    );
  }

  const googleNotice =
    created.googleNotice;

  const month =
    startDate.slice(0, 7);

  redirect(
    googleNotice
      ? `/schedule?month=${month}&notice=google`
      : `/schedule?month=${month}`
  );
}

export async function deleteScheduleEvent(
  formData: FormData
) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const id =
    String(formData.get("id") ?? "").trim();

  const requestedMonth =
    String(formData.get("month") ?? "").trim();

  if (!id) {
    redirect("/schedule");
  }

  const fullRead = await supabase
    .from("schedule_events")
    .select(`
      id,
      job_id,
      contract_id,
      client_id,
      start_date,
      google_calendar_id,
      google_event_id
    `)
    .eq("id", id)
    .maybeSingle();

  let row = fullRead.data;
  let readError = fullRead.error;

  if (readError) {
    const message = readError.message ?? "";
    const missingColumn =
      readError.code === "42703" ||
      readError.code === "PGRST204" ||
      /google_(event|calendar)_id/i.test(message);

    if (!missingColumn) {
      console.error(
        "Schedule delete could not read the appointment"
      );
      redirect(
        /^\d{4}-\d{2}$/.test(requestedMonth)
          ? `/schedule?month=${requestedMonth}&error=delete`
          : "/schedule?error=delete"
      );
    }

    const plainRead = await supabase
      .from("schedule_events")
      .select(`
        id,
        job_id,
        contract_id,
        client_id,
        start_date
      `)
      .eq("id", id)
      .maybeSingle();

    row = plainRead.data
      ? {
          ...plainRead.data,
          google_calendar_id: null,
          google_event_id: null,
        }
      : null;
    readError = plainRead.error;
  }

  const month =
    /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : typeof row?.start_date === "string"
        ? row.start_date.slice(0, 7)
        : "";

  const back = month
    ? `/schedule?month=${month}`
    : "/schedule";

  if (readError || !row) {
    console.error(
      "Schedule delete could not read the appointment"
    );
    redirect(withQuery(back, "error=delete"));
  }

  const removed =
    await removeScheduleEvent(
      supabase,
      row
    );

  if (!removed.ok) {
    redirect(
      withQuery(
        back,
        removed.reason === "google"
          ? "error=google-delete"
          : "error=delete"
      )
    );
  }

  revalidatePath("/schedule");
  revalidatePath("/jobs");
  revalidatePath("/contracts");

  if (row.job_id) {
    revalidatePath(`/jobs/${row.job_id}`);
  }

  if (row.client_id) {
    revalidatePath(`/clients/${row.client_id}`);
  }

  if (row.contract_id) {
    revalidatePath(`/contracts/${row.contract_id}`);
  }

  redirect(back);
}

function withQuery(path: string, query: string) {
  return path.includes("?")
    ? `${path}&${query}`
    : `${path}?${query}`;
}
