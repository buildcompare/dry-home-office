"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const {
    data: newEvent,
    error,
  } = await supabase
    .from("schedule_events")
    .insert({
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

      notes:
        String(
          formData.get(
            "notes"
          ) ?? ""
        ).trim() || null,
    })
    .select(`
      id,
      job_id,
      client_id,
      contract_id
    `)
    .single();

  if (
    error ||
    !newEvent
  ) {
    console.error(
      "Schedule save error:",
      error
    );

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

  redirect(
    `/schedule?month=${startDate.slice(
      0,
      7
    )}`
  );
}