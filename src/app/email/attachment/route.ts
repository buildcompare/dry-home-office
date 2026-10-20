import { attachmentHandler } from "@/lib/mail/attachment-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const GET = attachmentHandler("owner");
