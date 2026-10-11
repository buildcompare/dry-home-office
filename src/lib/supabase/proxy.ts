import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,

      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
            headers
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) =>
                request.cookies.set(
                  name,
                  value
                )
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) =>
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                )
            );

            Object.entries(
              headers
            ).forEach(
              ([key, value]) =>
                supabaseResponse.headers.set(
                  key,
                  value
                )
            );
          },
        },
      }
    );

  const { data } =
    await supabase.auth.getClaims();

  const user =
    data?.claims;

  const pathname =
    request.nextUrl.pathname;

  const isPublicRoute =
    pathname.startsWith(
      "/login"
    ) ||
    pathname.startsWith(
      "/auth"
    ) ||
    pathname === "/q" ||
    pathname.startsWith(
      "/q/"
    ) ||
    pathname === "/c" ||
    pathname.startsWith(
      "/c/"
    ) ||
    // Customer invoice, guarantee and variation links are emailed to
    // clients and use their own token, so they must not need a login.
    pathname === "/i" ||
    pathname.startsWith(
      "/i/"
    ) ||
    pathname === "/g" ||
    pathname.startsWith(
      "/g/"
    ) ||
    pathname === "/v" ||
    pathname.startsWith(
      "/v/"
    ) ||
    // Privacy Policy and Terms of Use (needed for Google OAuth publishing).
    pathname === "/privacy" ||
    pathname === "/terms" ||
    // Checks its own auth (session or bearer token) and answers with
    // JSON instead of a login redirect.
    pathname ===
      "/api/survey-reports" ||
    // Resend webhook: verified by its Svix signature, not a session.
    pathname ===
      "/api/webhooks/resend";

  if (
    !user &&
    !isPublicRoute
  ) {
    const url =
      request.nextUrl.clone();

    url.pathname =
      "/login";

    return NextResponse.redirect(
      url
    );
  }

  return supabaseResponse;
}