import { requireEmployee } from "@/lib/staff-auth";
import { loadStaffDashboard } from "@/lib/staff-dashboard-data";
import StaffDashboardView from "@/components/staff/StaffDashboardView";
import { StaffUnavailable } from "@/app/staff/StaffNotice";
import { eyebrow, h1 } from "@/app/staff/brand";

export default async function StaffDashboardPage() {
  const session = await requireEmployee();
  if (session.status !== "ok") return <StaffUnavailable status={session.status} />;
  const { supabase, staff } = session;
  const loaded = await loadStaffDashboard(supabase, staff.id);

  return (
    <div>
      <p className={eyebrow}>Dashboard</p>
      <h1 className={`${h1} mb-6`}>Hello, {staff.name.split(/\s+/)[0] || "there"}</h1>
      <StaffDashboardView
        dashboard={loaded.dashboard}
        contractedHours={loaded.contractedHours}
        setUpNote={loaded.dashboardsSetUp ? null : "Hours in lieu aren't set up yet, so the balance may be incomplete."}
      />
    </div>
  );
}
