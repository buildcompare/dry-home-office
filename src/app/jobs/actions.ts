"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addJob(formData: FormData) {
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const jobType = String(formData.get("job_type") ?? "").trim();

  if (!clientId || !title) {
    redirect("/jobs/new?error=Client%20and%20job%20title%20are%20required");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(`
      address_line_1,
      address_line_2,
      town,
      county,
      postcode
    `)
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    redirect("/jobs/new?error=Unable%20to%20find%20client");
  }

  const enteredAddress1 =
    String(formData.get("address_line_1") ?? "").trim();

  const enteredAddress2 =
    String(formData.get("address_line_2") ?? "").trim();

  const enteredTown =
    String(formData.get("town") ?? "").trim();

  const enteredCounty =
    String(formData.get("county") ?? "").trim();

  const enteredPostcode =
    String(formData.get("postcode") ?? "").trim();

  const { error } = await supabase.from("jobs").insert({
    client_id: clientId,
    title,
    job_type: jobType || null,
    status: String(formData.get("status") ?? "Enquiry"),

    address_line_1:
      enteredAddress1 || client.address_line_1 || null,

    address_line_2:
      enteredAddress2 || client.address_line_2 || null,

    town:
      enteredTown || client.town || null,

    county:
      enteredCounty || client.county || null,

    postcode:
      enteredPostcode || client.postcode || null,

    survey_date:
      String(formData.get("survey_date") ?? "") || null,

    start_date:
      String(formData.get("start_date") ?? "") || null,

    description:
      String(formData.get("description") ?? "").trim() || null,

    notes:
      String(formData.get("notes") ?? "").trim() || null,

    estimated_value:
      String(formData.get("estimated_value") ?? "").trim() || null,
  });

  if (error) {
    console.error(error);

    redirect("/jobs/new?error=Unable%20to%20save%20job");
  }

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/clients/${clientId}`);

  redirect("/jobs");
}