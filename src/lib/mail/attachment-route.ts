import { NextResponse, type NextRequest } from "next/server";
import { getMailUser, loadCredentials } from "@/lib/mail/store";
import { getAttachment, withImap } from "@/lib/mail/imap";
import { safeFolder, safeUid } from "@/lib/mail/addresses";

/** Download one attachment from the signed-in user's OWN mailbox. */
export function attachmentHandler(role: "owner" | "employee") {
  return async function GET(request: NextRequest) {
    const user = await getMailUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (user.role !== role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const params = request.nextUrl.searchParams;
    const folder = safeFolder(params.get("folder"));
    const uid = safeUid(params.get("uid"));
    const index = Number(params.get("i"));
    if (!uid || !Number.isInteger(index) || index < 0 || index > 500) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const creds = await loadCredentials(user);
    if (!creds) return NextResponse.json({ error: "Mailbox not connected" }, { status: 404 });

    let file: Awaited<ReturnType<typeof getAttachment>> = null;
    try {
      file = await withImap(creds, (imap) => getAttachment(imap, folder, uid, index));
    } catch {
      return NextResponse.json({ error: "The mailbox couldn't be reached." }, { status: 502 });
    }
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const name = file.filename.replace(/[\r\n"\\]/g, "_").slice(0, 200) || "attachment";
    // Never let the browser render mail content on our origin.
    const risky = /html|svg|xml|javascript/i.test(file.contentType);
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": risky ? "application/octet-stream" : file.contentType,
        "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  };
}
