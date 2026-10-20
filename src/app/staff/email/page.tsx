import { redirect } from "next/navigation";
import MailApp, { type MailSearchParams } from "@/components/mail/MailApp";
import { requireEmployee } from "@/lib/staff-auth";
import { getMailUser } from "@/lib/mail/store";
import { StaffUnavailable } from "@/app/staff/StaffNotice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function StaffEmailPage({ searchParams }: { searchParams: Promise<MailSearchParams> }) {
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;
  const user = await getMailUser();
  if (!user || user.role !== "employee") redirect("/staff");
  return <MailApp base="/staff/email" user={user} params={await searchParams} />;
}
