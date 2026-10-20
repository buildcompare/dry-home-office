import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MailApp, { type MailSearchParams } from "@/components/mail/MailApp";
import { getMailUser } from "@/lib/mail/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* James's own mailbox only. Nobody can open another person's mail here. */
export default async function OfficeEmailPage({ searchParams }: { searchParams: Promise<MailSearchParams> }) {
  const user = await getMailUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/staff/email");
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:p-8">
        <div className="mx-auto max-w-5xl">
          <MailApp base="/email" user={user} params={await searchParams} />
        </div>
      </main>
    </div>
  );
}
