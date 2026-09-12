"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addScheduleEvent(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "Other");
  const status = String(formData.get("status") ?? "Scheduled");

  const startDate = String(formData.get("start_date") ?? "");
  const endDate =
    String(formData.get("end_date") ?? "") || startDate;

  const startTime =
    String(formData.get("start_time") ?? "") || null;

  const endTime =
    String(formData.get("end_time") ?? "") || null;

  const allDay = formData.get("all_day") === "on";

  let clientId =
    String(formData.get("client_id") ?? "") || null;

  const jobId =
    String(formData.get("job_id") ?? "") || null;

  let location =
    String(formData.get("location") ?? "").trim() || null;

  if (!title || !startDate) {
    redirect(
      `/schedule/new?date=${startDate}&error=Title%20and%20start%20date%20are%20required`
    );
  }

  if (endDate < startDate) {
    redirect(
      `/schedule/new?date=${startDate}&error=End%20date%20cannot%20be%20before%20start%20date`
    );
  }

  // If linked to a job, automatically use that job's client.
  if (jobId) {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        client_id,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      redirect(
        `/schedule/new?date=${startDate}&error=Unable%20to%20find%20selected%20job`
      );
    }

    clientId = job.client_id;

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

  const { error } = await supabase
    .from("schedule_events")
    .insert({
      client_id: clientId,
      job_id: jobId,
      title,
      event_type: eventType,
      status,
      start_date: startDate,
      end_date: endDate,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      all_day: allDay,
      location,
      assigned_to:
        String(formData.get("assigned_to") ?? "").trim() ||
        null,
      notes:
        String(formData.get("notes") ?? "").trim() || null,
    });

  if (error) {
    console.error(error);

    redirect(
      `/schedule/new?date=${startDate}&error=Unable%20to%20save%20appointment`
    );
  }

  revalidatePath("/schedule");

  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
  }

  redirect(`/schedule?month=${startDate.slice(0, 7)}`);
}