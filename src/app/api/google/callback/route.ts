import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleCredentialsConfigured } from "@/lib/google-oauth";
import { exchangeGoogleCode, saveGoogleRefreshToken } from "@/lib/google-calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "dho_google_oauth_state";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const fail = (error: "config" | "google" | "setup") => {
    const response = NextResponse.redirect(
      new URL(`/settings/calendar?error=${error}`, request.url)
    );
    response.cookies.set({
      name: STATE_COOKIE,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/google",
      maxAge: 0,
    });
    return response;
  };

  if (!googleCredentialsConfigured()) return fail("config");

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value ?? "";

  if (!code || code.length > 2048 || !safeEqual(state, expected)) {
    return fail("google");
  }

  const refreshToken = await exchangeGoogleCode(code);
  if (!refreshToken) return fail("google");

  const saved = await saveGoogleRefreshToken(refreshToken);
  if (!saved) return fail("setup");

  const response = NextResponse.redirect(new URL("/settings/calendar?connected=1", request.url));
  response.cookies.set({
    name: STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: 0,
  });
  return response;
}

function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
