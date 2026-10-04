"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { rowsFromCsv, type ClientCsvRow } from "./csv";

function nameKey(value: string) {
  return value.trim().toLowerCase();
}

function emailKey(value: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email === "" ? null : email;
}

function phoneKey(value: string | null) {
  const phone = value?.trim() ?? "";
  return phone === "" ? null : phone;
}

function postcodeKey(value: string | null) {
  const postcode = value?.trim().toUpperCase() ?? "";
  return postcode === "" ? null : postcode;
}

function isDuplicate(
  row: ClientCsvRow,
  emails: Set<string>,
  namePhones: Set<string>,
  namePostcodes: Set<string>
) {
  const email = emailKey(row.email);

  if (email) {
    return emails.has(email);
  }

  const name = nameKey(row.display_name ?? "");
  const phone = phoneKey(row.phone);
  const postcode = postcodeKey(row.postcode);

  if (phone && namePhones.has(`${name}|${phone}`)) {
    return true;
  }

  if (postcode && namePostcodes.has(`${name}|${postcode}`)) {
    return true;
  }

  return false;
}

function remember(
  row: ClientCsvRow,
  emails: Set<string>,
  namePhones: Set<string>,
  namePostcodes: Set<string>
) {
  const email = emailKey(row.email);
  const name = nameKey(row.display_name ?? "");
  const phone = phoneKey(row.phone);
  const postcode = postcodeKey(row.postcode);

  if (email) {
    emails.add(email);
  }

  if (name && phone) {
    namePhones.add(`${name}|${phone}`);
  }

  if (name && postcode) {
    namePostcodes.add(`${name}|${postcode}`);
  }
}

export async function importClients(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      "/clients?error=Choose%20a%20.csv%20file%20to%20import"
    );
  }

  let rows: ClientCsvRow[];

  try {
    rows = rowsFromCsv(await file.text());
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to read that CSV";

    redirect(
      `/clients?error=${encodeURIComponent(message)}`
    );
  }

  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("clients")
    .select("display_name, email, phone, postcode");

  if (readError) {
    console.error("Client import read error:", readError);
    redirect(
      "/clients?error=Unable%20to%20read%20existing%20clients"
    );
  }

  const emails = new Set<string>();
  const namePhones = new Set<string>();
  const namePostcodes = new Set<string>();

  for (const client of existing ?? []) {
    remember(
      {
        display_name: client.display_name,
        friendly_name: null,
        company_name: null,
        email: client.email,
        phone: client.phone,
        address_line_1: null,
        address_line_2: null,
        town: null,
        county: null,
        postcode: client.postcode,
        notes: null,
      },
      emails,
      namePhones,
      namePostcodes
    );
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const displayName = row.display_name?.trim() ?? "";

    if (!displayName || isDuplicate(row, emails, namePhones, namePostcodes)) {
      skipped++;
      continue;
    }

    const email = emailKey(row.email);
    const postcode = postcodeKey(row.postcode);
    const insertRow = {
      display_name: displayName,
      friendly_name: row.friendly_name,
      company_name: row.company_name,
      email,
      phone: phoneKey(row.phone),
      address_line_1: row.address_line_1,
      address_line_2: row.address_line_2,
      town: row.town,
      county: row.county,
      postcode,
      notes: row.notes,
    };

    const { error } = await supabase.from("clients").insert(insertRow);

    if (error) {
      console.error("Client import insert error:", error);
      skipped++;
      continue;
    }

    remember(
      { ...row, display_name: displayName, email, postcode },
      emails,
      namePhones,
      namePostcodes
    );
    imported++;
  }

  revalidatePath("/clients");
  redirect(`/clients?imported=${imported}&skipped=${skipped}`);
}

