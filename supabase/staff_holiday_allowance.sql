-- Holiday allowance per employee (days per holiday year, excluding bank holidays).
-- Run AFTER supabase/staff_portal.sql. Safe to re-run.

alter table public.staff_members
  add column if not exists holiday_allowance_days numeric(5,1) not null default 28;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_members_holiday_allowance_days_check'
  ) then
    alter table public.staff_members
      add constraint staff_members_holiday_allowance_days_check
      check (holiday_allowance_days >= 0 and holiday_allowance_days <= 366);
  end if;
end $$;

-- Employees only have a read policy on their own staff_members row, so
-- they can see but not change their allowance. Owners can edit it.

notify pgrst, 'reload schema';
