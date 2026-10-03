"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedCalendarUrl } from "@/lib/google-calendar";

export async function saveCalendarFeeds(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("office_calendar_feeds")
    .select("work_ics_url, family_ics_url")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    redirect("/settings/calendar?error=setup");
  }

  const work = nextUrl(
    formData,
    "work_ics_url",
    "clear_work",
    existing?.work_ics_url ?? null
  );
  const family = nextUrl(
    formData,
    "family_ics_url",
    "clear_family",
    existing?.family_ics_url ?? null
  );

  if (work === "invalid" || family === "invalid") {
    redirect("/settings/calendar?error=invalid");
  }

  const { error } = await admin.from("office_calendar_feeds").upsert({
    id: 1,
    work_ics_url: work,
    family_ics_url: family,
  });

  if (error) {
    redirect("/settings/calendar?error=save");
  }

  revalidatePath("/settings/calendar");
  revalidatePath("/schedule");
  redirect("/settings/calendar?saved=1");
}

function nextUrl(
  formData: FormData,
  field: string,
  clearField: string,
  current: string | null
): string | null | "invalid" {
  if (formData.get(clearField) === "on") return null;
  const entered = String(formData.get(field) ?? "").trim();
  if (!entered) return current;
  if (!isAllowedCalendarUrl(entered)) return "invalid";
  return entered;
}
