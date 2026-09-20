"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const allowedTemplateKeys = [
  "quote",
  "contract",
  "invoice",
  "guarantee",
] as const;

type TemplateKey =
  (typeof allowedTemplateKeys)[number];

export async function updateEmailTemplate(
  formData: FormData
) {
  const supabase =
    await createClient();

  const templateKey =
    String(
      formData.get(
        "template_key"
      ) || ""
    ).trim();

  const subject =
    String(
      formData.get(
        "subject"
      ) || ""
    ).trim();

  const body =
    String(
      formData.get(
        "body"
      ) || ""
    ).trim();

  if (
    !allowedTemplateKeys.includes(
      templateKey as TemplateKey
    )
  ) {
    redirect(
      "/settings/email-templates?error=Invalid%20email%20template"
    );
  }

  if (!subject) {
    redirect(
      `/settings/email-templates?error=Please%20enter%20an%20email%20subject#${templateKey}`
    );
  }

  if (!body) {
    redirect(
      `/settings/email-templates?error=Please%20enter%20email%20content#${templateKey}`
    );
  }

  const { error } =
    await supabase
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
      `/settings/email-templates?error=Unable%20to%20save%20email%20template#${templateKey}`
    );
  }

  revalidatePath(
    "/settings/email-templates"
  );

  redirect(
    `/settings/email-templates?saved=${templateKey}#${templateKey}`
  );
}