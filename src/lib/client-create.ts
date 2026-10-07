/*
 * Shared client insert. Saves secondary_email when it is given, and if
 * the clients.secondary_email column has not been added yet
 * (supabase/clients_secondary_email.sql) saves everything else so the
 * client is not lost. Used by Add Client and Book Survey.
 */

import type { createClient } from "@/lib/supabase/server";
import { isMissingSecondaryEmailColumn } from "@/lib/client-secondary-email";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NewClientRow = {
  display_name: string;
  friendly_name?: string | null;
  company_name?: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  notes?: string | null;
};

export async function insertClientRow(
  supabase: SupabaseServerClient,
  baseRow: NewClientRow,
  secondaryEmail: string | null
) {
  let secondaryEmailNotSaved = false;

  let { data: client, error } = await supabase
    .from("clients")
    .insert({
      ...baseRow,

      ...(secondaryEmail
        ? {
            secondary_email: secondaryEmail,
          }
        : {}),
    })
    .select("id")
    .single();

  if (isMissingSecondaryEmailColumn(error)) {
    /*
     * The secondary_email column has not been added to the
     * database yet. Save everything else so the client is not lost.
     */

    console.error(
      "clients.secondary_email column is missing; saving client without it."
    );

    secondaryEmailNotSaved = Boolean(secondaryEmail);

    ({ data: client, error } = await supabase
      .from("clients")
      .insert(baseRow)
      .select("id")
      .single());
  }

  return {
    clientId: (client?.id as string | undefined) ?? null,
    error,
    secondaryEmailNotSaved,
  };
}
