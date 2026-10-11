/*
 * Resend webhook: email delivered / opened / clicked / bounced /
 * complained. Verified with the Svix signature using
 * RESEND_WEBHOOK_SECRET. With that env var unset it answers 503 and
 * does nothing.
 *
 * Events are matched to the record through the Resend email id stored
 * on the "email.sent" activity event when the email was sent.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import type { ActivityEventType, ActivityRecordType } from "@/lib/activity-shared";
import { isRecordType } from "@/lib/activity-shared";
import { verifySvixSignature } from "@/lib/svix-verify";

export const dynamic = "force-dynamic";

const HANDLED: Record<string, ActivityEventType> = {
  "email.delivered": "email.delivered",
  "email.opened": "email.opened",
  "email.clicked": "email.clicked",
  "email.bounced": "email.bounced",
  "email.complained": "email.complained",
};

// Opens and clicks can fire many times; keep one per email per hour.
const REPEATABLE = new Set(["email.opened", "email.clicked"]);
const REPEAT_THROTTLE_MS = 60 * 60 * 1000;

type ResendWebhook = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    click?: { link?: string };
    bounce?: { message?: string; type?: string };
  };
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return json({ error: "Resend webhook is not configured." }, 503);
  }

  const body = await request.text();

  const valid = verifySvixSignature(
    secret,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body
  );

  if (!valid) {
    return json({ error: "Invalid signature." }, 401);
  }

  let payload: ResendWebhook;

  try {
    payload = JSON.parse(body) as ResendWebhook;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const eventType = payload.type ? HANDLED[payload.type] : undefined;

  if (!eventType) {
    return json({ ok: true, ignored: payload.type ?? null });
  }

  const webhookId = request.headers.get("svix-id");
  const emailId = payload.data?.email_id ?? null;

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("Resend webhook: Supabase admin client unavailable:", error);
    return json({ error: "Server is not configured." }, 500);
  }

  // Retries from Resend reuse the same svix-id: only log once.
  if (webhookId) {
    const { data: existing, error } = await supabase
      .from("activity_events")
      .select("id")
      .eq("metadata->>webhook_id", webhookId)
      .limit(1);

    if (error) {
      // activity_events not set up yet: acknowledge so Resend stops retrying.
      return json({ ok: true, logged: false, reason: "activity log not set up" });
    }

    if (existing && existing.length > 0) {
      return json({ ok: true, duplicate: true });
    }
  }

  let sent: Record<string, unknown> | null = null;

  if (emailId) {
    const { data } = await supabase
      .from("activity_events")
      .select("record_type, record_id, record_number, client_id, client_name, metadata")
      .eq("event_type", "email.sent")
      .eq("metadata->>resend_id", emailId)
      .order("created_at", { ascending: false })
      .limit(1);

    sent = (data?.[0] as Record<string, unknown> | undefined) ?? null;

    if (REPEATABLE.has(eventType)) {
      const { data: recent } = await supabase
        .from("activity_events")
        .select("created_at")
        .eq("event_type", eventType)
        .eq("metadata->>resend_id", emailId)
        .gte("created_at", new Date(Date.now() - REPEAT_THROTTLE_MS).toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        return json({ ok: true, throttled: true });
      }
    }
  }

  const to = payload.data?.to;
  const recipients = Array.isArray(to) ? to : to ? [to] : [];
  const sentMeta = (sent?.metadata as Record<string, unknown> | undefined) ?? {};
  const recordType = isRecordType(sent?.record_type) ? (sent?.record_type as ActivityRecordType) : null;

  const logged = await logActivity(supabase, {
    event_type: eventType,
    record_type: recordType,
    record_id: (sent?.record_id as string | null) ?? null,
    record_number: (sent?.record_number as string | null) ?? null,
    client_id: (sent?.client_id as string | null) ?? null,
    client_name: (sent?.client_name as string | null) ?? null,
    metadata: {
      resend_id: emailId,
      webhook_id: webhookId,
      recipients,
      subject: payload.data?.subject ?? sentMeta.subject ?? null,
      job_id: sentMeta.job_id ?? undefined,
      link: payload.data?.click?.link ?? undefined,
      bounce: payload.data?.bounce?.message ?? undefined,
      event_at: payload.created_at ?? null,
    },
  });

  return json({ ok: true, logged, matched: Boolean(sent) });
}
