-- Staff dashboards: contracted weekly hours and "hours in lieu" taken.
-- Run AFTER supabase/staff_portal.sql. Safe to re-run.

alter table public.staff_members
  add column if not exists contracted_weekly_hours numeric(5,2) not null default 40;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_members_contracted_weekly_hours_check'
  ) then
    alter table public.staff_members
      add constraint staff_members_contracted_weekly_hours_check
      check (contracted_weekly_hours >= 0 and contracted_weekly_hours <= 168);
  end if;
end $$;

-- Employees already can't update staff_members (they only have a read
-- policy on their own row), so they can't change their contracted hours.

create table if not exists public.lieu_taken (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  taken_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 10080),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists lieu_taken_staff_idx on public.lieu_taken (staff_id, taken_date desc);

alter table public.lieu_taken enable row level security;

grant select, insert, update, delete on public.lieu_taken to authenticated;
revoke all on public.lieu_taken from anon;

drop policy if exists "lieu taken owner all" on public.lieu_taken;
create policy "lieu taken owner all" on public.lieu_taken
  for all to authenticated
  using ((select public.is_office_owner()))
  with check ((select public.is_office_owner()));

drop policy if exists "lieu taken employee read" on public.lieu_taken;
create policy "lieu taken employee read" on public.lieu_taken
  for select to authenticated
  using (staff_id = (select public.current_employee_id()));

notify pgrst, 'reload schema';
