import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StaffDashboardView from "@/components/staff/StaffDashboardView";
import { requireOwnerForTeam } from "@/lib/staff-auth";
import { loadStaffDashboard } from "@/lib/staff-dashboard-data";
import { formatLongDay, formatMinutes } from "@/lib/staff";
import { getLondonDateKey } from "@/lib/dates";
import { addLieuTaken, deleteLieuTaken, setContractedHours, setHolidayAllowance } from "@/app/team/actions";
import { btnDanger, btnDark, btnPrimary, card, eyebrow, h1, input } from "@/app/staff/brand";

export default async function TeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireOwnerForTeam();

  const { data: member } = await supabase
    .from("staff_members")
    .select("id, name, email, role, active")
    .eq("id", id)
    .maybeSingle();
  if (!member) notFound();

  const loaded = await loadStaffDashboard(supabase, member.id);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:p-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/team" className="text-sm font-semibold text-slate-500 hover:text-[#252525]">← Staff</Link>
          <p className={`${eyebrow} mt-3`}>Employee dashboard</p>
          <h1 className={h1}>{member.name}</h1>
          <p className="mb-6 text-sm text-slate-500">
            {member.email} · {member.active ? "Active" : "Deactivated"}
          </p>

          {query.error && <p className="mb-4 rounded-xl border-l-4 border-[#be1e2d] bg-white p-3 text-sm font-medium text-[#be1e2d] shadow-sm">{query.error}</p>}
          {query.notice && <p className="mb-4 rounded-xl border-l-4 border-[#252525] bg-white p-3 text-sm font-medium text-[#252525] shadow-sm">{query.notice}</p>}

          <StaffDashboardView
            dashboard={loaded.dashboard}
            contractedHours={loaded.contractedHours}
        bankHolidays={loaded.bankHolidays}
            setUpNote={loaded.dashboardsSetUp ? null : "Run supabase/staff_dashboards.sql to enable contracted hours and lieu time (40h is assumed until then)."}
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h2 className="mb-3 text-lg font-semibold text-[#252525]">Contracted hours</h2>
              <form action={setContractedHours} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="staff_id" value={member.id} />
                <label className="block text-sm font-medium text-slate-700">
                  Hours per week
                  <input name="contracted_weekly_hours" type="number" min={0} max={168} step={0.25} inputMode="decimal" defaultValue={loaded.contractedHours} className={`${input} w-32`} />
                </label>
                <button className={btnDark} disabled={!loaded.dashboardsSetUp}>Save</button>
              </form>
              <p className="mt-2 text-xs text-slate-500">Hours over this in an approved week are earned as hours in lieu.</p>

              <h2 className="mb-3 mt-6 text-lg font-semibold text-[#252525]">Holiday allowance</h2>
              <form action={setHolidayAllowance} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="staff_id" value={member.id} />
                <label className="block text-sm font-medium text-slate-700">
                  Days per year
                  <input name="holiday_allowance_days" type="number" min={0} max={366} step={0.5} inputMode="decimal" defaultValue={loaded.allowanceDays} className={`${input} w-32`} disabled={!loaded.allowanceSetUp} />
                </label>
                <button className={btnDark} disabled={!loaded.allowanceSetUp}>Save</button>
              </form>
              <p className="mt-2 text-xs text-slate-500">
                {loaded.allowanceSetUp
                  ? "Not including bank holidays. Holiday year runs January to December."
                  : "Run supabase/staff_holiday_allowance.sql to edit this (28 days is assumed until then)."}
              </p>
            </section>

            <section className={card}>
              <h2 className="mb-3 text-lg font-semibold text-[#252525]">Record lieu taken</h2>
              <form action={addLieuTaken} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="staff_id" value={member.id} />
                <label className="block text-sm font-medium text-slate-700">
                  Date
                  <input name="taken_date" type="date" required defaultValue={getLondonDateKey()} className={input} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Hours
                  <input name="hours" required placeholder="e.g. 4 or 7.5" inputMode="decimal" className={input} spellCheck={false} />
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Note (optional)
                  <input name="note" className={input} />
                </label>
                <div className="sm:col-span-2">
                  <button className={btnPrimary} disabled={!loaded.dashboardsSetUp}>Record</button>
                </div>
              </form>
            </section>
          </div>

          <section className={`${card} mt-4`}>
            <h2 className="mb-2 text-lg font-semibold text-[#252525]">Lieu taken</h2>
            {loaded.lieuRows.length === 0 ? (
              <p className="text-sm text-slate-500">None recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {loaded.lieuRows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-[#252525]">
                      {formatLongDay(row.taken_date)} · <strong>{formatMinutes(row.minutes)}</strong>
                      {row.note && <span className="block text-xs text-slate-500">{row.note}</span>}
                    </span>
                    <form action={deleteLieuTaken}>
                      <input type="hidden" name="staff_id" value={member.id} />
                      <input type="hidden" name="lieu_id" value={row.id} />
                      <button className={btnDanger}>Delete</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
