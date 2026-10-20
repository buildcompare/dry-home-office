import { formatHolidayRange, formatMinutes, holidayDays } from "@/lib/staff";
import { formatDays, formatSignedMinutes, type StaffDashboard } from "@/lib/staff-dashboard";
import { card } from "@/app/staff/brand";
import { BrandStatusPill } from "@/app/staff/StaffNotice";

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={`${card} border-t-4 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#252525]">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function StaffDashboardView({
  dashboard,
  contractedHours,
  setUpNote,
}: {
  dashboard: StaffDashboard;
  contractedHours: number;
  setUpNote?: string | null;
}) {
  const { hours, lieu, holiday } = dashboard;
  const pending = (minutes: number) => (minutes > 0 ? `+ ${formatMinutes(minutes)} awaiting approval` : "All approved");

  return (
    <div className="space-y-6">
      {setUpNote && (
        <p className="rounded-xl border-l-4 border-[#f29e23] bg-white p-3 text-sm text-[#252525] shadow-sm">{setUpNote}</p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#252525]">Hours worked</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="This week" value={formatMinutes(hours.week.approved)} sub={pending(hours.week.pending)} accent="border-[#be1e2d]" />
          <Stat label="This month" value={formatMinutes(hours.month.approved)} sub={pending(hours.month.pending)} accent="border-[#f29e23]" />
          <Stat label="This year" value={formatMinutes(hours.year.approved)} sub={pending(hours.year.pending)} accent="border-[#252525]" />
        </div>
        <p className="mt-2 text-xs text-slate-500">Approved timesheets only; submitted weeks are shown as awaiting approval.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#252525]">Hours in lieu</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Balance" value={formatSignedMinutes(lieu.balance)} accent="border-[#be1e2d]" sub="Earned minus taken" />
          <Stat label="Earned" value={formatMinutes(lieu.accrued)} accent="border-[#f29e23]" sub={`Over ${contractedHours}h in approved weeks`} />
          <Stat label="Taken" value={formatMinutes(lieu.taken)} accent="border-[#252525]" sub="Recorded by the office" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#252525]">Holiday {holiday.year}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Requested" value={formatDays(holiday.pending.days)} sub={`${holiday.pending.count} pending`} accent="border-[#f29e23]" />
          <Stat label="Accepted" value={formatDays(holiday.approved.days)} sub={`${holiday.approved.count} approved`} accent="border-[#252525]" />
          <Stat label="Rejected" value={formatDays(holiday.rejected.days)} sub={`${holiday.rejected.count} rejected`} accent="border-[#be1e2d]" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h3 className="mb-2 font-semibold text-[#252525]">Upcoming holiday</h3>
            {holiday.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No approved holiday coming up.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {holiday.upcoming.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-[#252525]">{formatHolidayRange(h)}</span>
                    <span className="whitespace-nowrap text-slate-500">{formatDays(holidayDays(h))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={card}>
            <h3 className="mb-2 font-semibold text-[#252525]">Recent requests</h3>
            {holiday.recent.length === 0 ? (
              <p className="text-sm text-slate-500">No holiday requested yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {holiday.recent.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-[#252525]">
                      {formatHolidayRange(h)}
                      <span className="block text-xs text-slate-500">{formatDays(holidayDays(h))}</span>
                    </span>
                    <BrandStatusPill status={h.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
