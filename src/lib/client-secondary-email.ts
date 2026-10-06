/*
 * The `clients.secondary_email` column is added by
 * supabase/clients_secondary_email.sql. Until that migration has been
 * run, PostgREST reports the column as missing. Everything in here
 * degrades gracefully so client pages, saves and sends keep working
 * either way.
 */

import type { createClient } from "@/lib/supabase/server";

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

export const SECONDARY_EMAIL_COLUMN =
  "secondary_email";

/**
 * True when a Supabase/PostgREST error says the secondary_email
 * column does not exist (migration not applied yet).
 */
export function isMissingSecondaryEmailColumn(
  error: PostgrestLikeError
) {
  if (!error) {
    return false;
  }

  const text = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const mentionsColumn =
    text.includes(
      SECONDARY_EMAIL_COLUMN
    );

  return (
    mentionsColumn &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      text.includes(
        "does not exist"
      ) ||
      text.includes(
        "could not find"
      ) ||
      text.includes(
        "schema cache"
      ))
  );
}

type SupabaseLike = Pick<
  Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  "from"
>;

/**
 * Load one client's secondary email. Returns null when the client
 * has none, or when the column does not exist yet / cannot be read.
 */
export async function loadClientSecondaryEmail(
  supabase: SupabaseLike,
  clientId:
    | string
    | null
    | undefined
): Promise<string | null> {
  if (!clientId) {
    return null;
  }

  try {
    const {
      data,
      error,
    } = await supabase
      .from("clients")
      .select(
        SECONDARY_EMAIL_COLUMN
      )
      .eq(
        "id",
        clientId
      )
      .maybeSingle();

    if (error) {
      if (
        !isMissingSecondaryEmailColumn(
          error
        )
      ) {
        console.error(
          "Unable to load client secondary email:",
          error
        );
      }

      return null;
    }

    const value =
      (
        data as {
          secondary_email?:
            | string
            | null;
        } | null
      )?.secondary_email;

    return (
      value?.trim() ||
      null
    );
  } catch (error) {
    console.error(
      "Unable to load client secondary email:",
      error
    );

    return null;
  }
}
