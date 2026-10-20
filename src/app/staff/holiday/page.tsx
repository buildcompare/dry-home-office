import { getLondonDateKey } from "@/lib/dates";
import { requireEmployee } from "@/lib/staff-auth";
import { formatHolidayRange, holidayDays } from "@/lib/staff";
import { loadStaffDashboard } from "@/lib/staff-dashboard-data";
import { holidayYearOf } from "@/lib/bank-holidays";
import { HolidayBalance } from "@/components/staff/StaffDashboardView";
import HolidayRequestPreview from "@/app/staff/holiday/HolidayRequestPreview";
import { cancelHolidayRequest, requestHoliday } from "@/app/staff/actions";
import { Flash, StaffUnavailable, BrandStatusPill } from "@/app/staff/StaffNotice";
import { btnDanger, btnPrimary, eyebrow, h1, input } from "@/app/staff/brand";

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

  const loaded = await loadStaffDashboard(supabase, staff.id);
  const bank = loaded.bankHolidays;
  const today = getLondonDateKey();

  return (
    <div>
      <p className={eyebrow}>Time off</p>
          <h1 className={`${h1} mb-1`}>Holiday</h1>
      <div className="mb-6 mt-3">
        <HolidayBalance holiday={loaded.dashboard.holiday} />
      </div>

      <Flash error={params.error} saved={params.saved} />

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-[#252525]">Request holiday</h2>
        <form action={requestHoliday} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            First day
            <input type="date" name="start_date" required min={today} className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Last day
            <input type="date" name="end_date" min={today} className={input} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#be1e2d]" name="half_day" /> Half day only (uses the first day)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" className="h-4 w-4 accent-[#be1e2d]" name="half_day_part" value="am" defaultChecked /> Morning
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" className="h-4 w-4 accent-[#be1e2d]" name="half_day_part" value="pm" /> Afternoon
            </label>
          </div>
          <HolidayRequestPreview
            bankHolidays={[...bank]}
            available={loaded.dashboard.holiday.available}
            currentYear={holidayYearOf(today)}
          />
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Reason (optional)
            <textarea name="reason" rows={2} className={input} />
          </label>
          <div className="sm:col-span-2">
            <button className={btnPrimary}>
              Send request
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-[#252525]">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-600">No holiday requested yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-2 rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-[#252525]">{formatHolidayRange(request)}</p>
                  <p>
                    {holidayDays(request, { bankHolidays: bank })} {holidayDays(request, { bankHolidays: bank }) === 1 ? "day" : "days"}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </p>
                  {request.review_note && <p className="text-slate-500">Office note: {request.review_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <BrandStatusPill status={request.status} />
                  {request.status === "pending" && (
                    <form action={cancelHolidayRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button className={btnDanger}>Cancel</button>
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
