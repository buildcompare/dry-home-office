import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Static files (images, icons, the app manifest, service worker and
    // offline page) skip the session/role check entirely: they were public
    // already, and the check costs Supabase round trips on every request.
    "/((?!api/calendar|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$).*)",
  ],
};