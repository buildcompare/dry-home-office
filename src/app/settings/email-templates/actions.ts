"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const allowedTemplateKeys = new Set([
  "quote",
  "contract",
  "invoice",
  "guarantee",
  "variation",
]);

export async function updateEmailTemplate(
  formData: FormData
) {
  const templateKey = String(
    formData.get("template_key") ?? ""
  ).trim();

  const subject = String(
    formData.get("subject") ?? ""
  ).trim();

  const body = String(
    formData.get("body") ?? ""
  ).trim();

  if (
    !templateKey ||
    !allowedTemplateKeys.has(
      templateKey
    )
  ) {
    redirect(
      "/settings/email-templates?error=Invalid%20email%20template"
    );
  }

  if (!subject) {
    redirect(
      `/settings/email-templates?error=${encodeURIComponent(
        "Email subject is required."
      )}`
    );
  }

  if (!body) {
    redirect(
      `/settings/email-templates?error=${encodeURIComponent(
        "Email message is required."
      )}`
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } = await supabase
    .from(
      "email_templates"
    )
    .update({
      subject,
      body,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "template_key",
      templateKey
    );

  if (error) {
    console.error(
      "Email template update error:",
      error
    );

    redirect(
      `/settings/email-templates?error=${encodeURIComponent(
        "Unable to save email template."
      )}`
    );
  }

  revalidatePath(
    "/settings/email-templates"
  );

  redirect(
    `/settings/email-templates?updated=${encodeURIComponent(
      templateKey
    )}`
  );
}