import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";

  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "Type a message first." }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Chat isn't connected to a model yet." },
      { status: 503 }
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the assistant inside DryHome Office, for a damp-proofing business. Help with clients, jobs, quotes, contracts, and invoices. Never claim you created or changed a record. Keep replies to a few sentences.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "The model didn't reply." },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const reply = payload?.choices?.[0]?.message?.content;

  if (typeof reply !== "string" || !reply.trim()) {
    return NextResponse.json(
      { error: "The model didn't reply." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply: reply.trim() });
}
