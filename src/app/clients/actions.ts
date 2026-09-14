"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addClient(formData: FormData) {
  const supabase = await createClient();

  const displayName = String(
    formData.get("display_name") || ""
  ).trim();

  const friendlyName =
    String(
      formData.get("friendly_name") || ""
    ).trim() || null;

  const companyName =
    String(
      formData.get("company_name") || ""
    ).trim() || null;

  const email =
    String(
      formData.get("email") || ""
    )
      .trim()
      .toLowerCase() || null;

  const phone =
    String(
      formData.get("phone") || ""
    ).trim() || null;

  const addressLine1 =
    String(
      formData.get("address_line_1") || ""
    ).trim() || null;

  const addressLine2 =
    String(
      formData.get("address_line_2") || ""
    ).trim() || null;

  const town =
    String(
      formData.get("town") || ""
    ).trim() || null;

  const county =
    String(
      formData.get("county") || ""
    ).trim() || null;

  const postcode =
    String(
      formData.get("postcode") || ""
    )
      .trim()
      .toUpperCase() || null;

  const notes =
    String(
      formData.get("notes") || ""
    ).trim() || null;

  if (!displayName) {
    redirect(
      "/clients/new?error=Please%20enter%20a%20client%20name"
    );
  }

  const { data: client, error } =
    await supabase
      .from("clients")
      .insert({
        display_name: displayName,
        friendly_name: friendlyName,
        company_name: companyName,
        email,
        phone,
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        town,
        county,
        postcode,
        notes,
      })
      .select("id")
      .single();

  if (error || !client) {
    console.error(
      "Client creation error:",
      error
    );

    redirect(
      "/clients/new?error=Unable%20to%20create%20client"
    );
  }

  revalidatePath("/");
  revalidatePath("/clients");

  redirect(`/clients/${client.id}`);
}