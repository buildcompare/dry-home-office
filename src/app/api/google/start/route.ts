import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleAuthUrl, googleCredentialsConfigured, safeGoogleReturnPath } from "@/lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "dho_google_oauth_state";
const RETURN_COOKIE = "dho_google_oauth_return";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!googleCredentialsConfigured()) {
    return NextResponse.redirect(new URL("/settings/calendar?error=config", request.url));
  }

  // Always access_type=offline + prompt=consent (see googleAuthUrl), so
  // Google issues a fresh refresh token that replaces the stored one.
  const state = randomBytes(32).toString("hex");
  const returnTo = safeGoogleReturnPath(new URL(request.url).searchParams.get("return"));
  const response = NextResponse.redirect(googleAuthUrl(process.env.GOOGLE_CLIENT_ID!.trim(), state));
  response.cookies.set({
    name: RETURN_COOKIE,
    value: returnTo ?? "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: returnTo ? 10 * 60 : 0,
  });
  response.cookies.set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: 10 * 60,
  });
  return response;
}
