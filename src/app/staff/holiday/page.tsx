import { getLondonDateKey } from "@/lib/dates";
import { requireEmployee } from "@/lib/staff-auth";
import { formatHolidayRange, holidayDays } from "@/lib/staff";
import { cancelHolidayRequest, requestHoliday } from "@/app/staff/actions";
import { Flash, StaffUnavailable, StatusPill } from "@/app/staff/StaffNotice";

type HolidayRow = {
  id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_part: string | null;
  reason: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
};

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export default async function HolidayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;
  const { supabase, staff } = session;

  const { data } = await supabase
    .from("holiday_requests")
    .select("id, start_date, end_date, half_day, half_day_part, reason, status, review_note, created_at")
    .eq("staff_id", staff.id)
    .order("start_date", { ascending: false })
    .limit(100);
  const requests = (data ?? []) as HolidayRow[];

  const year = getLondonDateKey().slice(0, 4);
  const approvedThisYear = requests
    .filter((request) => request.status === "approved" && request.start_date.startsWith(year))
    .reduce((sum, request) => sum + holidayDays(request), 0);
  const today = getLondonDateKey();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Holiday</h1>
      <p className="mb-4 text-sm text-slate-600">
        Approved this year: <strong>{approvedThisYear}</strong> {approvedThisYear === 1 ? "day" : "days"}
      </p>

      <Flash error={params.error} saved={params.saved} />

      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Request holiday</h2>
        <form action={requestHoliday} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            First day
            <input type="date" name="start_date" required min={today} className={input} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Last day
            <input type="date" name="end_date" min={today} className={input} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="half_day" /> Half day only (uses the first day)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="half_day_part" value="am" defaultChecked /> Morning
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="half_day_part" value="pm" /> Afternoon
            </label>
          </div>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Reason (optional)
            <textarea name="reason" rows={2} className={input} />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Send request
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-600">No holiday requested yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white p-4 shadow-sm">
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{formatHolidayRange(request)}</p>
                  <p>
                    {holidayDays(request)} {holidayDays(request) === 1 ? "day" : "days"}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </p>
                  {request.review_note && <p className="text-slate-500">Office note: {request.review_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={request.status} />
                  {request.status === "pending" && (
                    <form action={cancelHolidayRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button className="rounded-lg px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50">Cancel</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
