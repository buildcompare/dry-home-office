-- Staff portal: employee logins, timesheets, holiday requests and a
-- read-only Schedule. Run once in the Supabase SQL Editor (safe to re-run).
--
-- Roles
--   * staff_members maps a login (by auth user id, or by email until the
--     first sign-in) to role 'owner' or 'employee'.
--   * Any signed-in user WITHOUT a staff_members row is treated as an
--     owner, so existing office logins (James) are never locked out.
--   * A deactivated row (active = false) gets no access at all.
--
-- What it changes on existing tables
--   * Adds RESTRICTIVE policies so that only owners can use the office
--     tables (clients, jobs, quotes, invoices, …) through the API.
--     Restrictive policies only narrow access; existing policies for
--     owners keep working exactly as before. Existing rows are untouched.
--   * schedule_events: employees may read, only owners may write.
--   * survey-reports storage bucket: owners only.
--   * Tables that have row level security switched OFF are reported with
--     a NOTICE and left alone (switching RLS on could break the app).

/* =========================================================
   TABLES
   ========================================================= */

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null,
  name text not null,
  role text not null default 'employee' check (role in ('owner', 'employee')),
  active boolean not null default true,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_members_email_key
  on public.staff_members (lower(email));

create table if not exists public.timesheet_weeks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz not null default now(),
  unique (staff_id, week_start)
);

create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  week_start date not null,
  work_date date not null,
  start_time time not null,
  finish_time time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  -- job reference is a plain snapshot (no FK), so employees never need
  -- to read the jobs table.
  job_id uuid,
  job_label text,
  notes text,
  created_at timestamptz not null default now(),
  check (finish_time > start_time)
);

create index if not exists timesheet_entries_staff_week_idx
  on public.timesheet_entries (staff_id, week_start, work_date);

create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  half_day_part text check (half_day_part in ('am', 'pm')),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- the all-day "Holiday – Name" Schedule entry created on approval
  schedule_event_id uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists holiday_requests_staff_idx
  on public.holiday_requests (staff_id, start_date desc);

/* =========================================================
   ROLE FUNCTIONS (security definer: they read staff_members
   regardless of the caller's policies)
   ========================================================= */

create or replace function public.current_staff_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.staff_members s
  where s.user_id = auth.uid()
     or (s.user_id is null and lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  order by (s.user_id = auth.uid()) desc nulls last
  limit 1
$$;

-- 'owner' | 'employee' | 'inactive'. No row at all = 'owner'.
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case when s.active then s.role else 'inactive' end
      from public.staff_members s
      where s.id = public.current_staff_member_id()
    ),
    'owner'
  )
$$;

create or replace function public.is_office_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() = 'owner'
$$;

-- Active employee's own staff id (null for owners / inactive).
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when public.current_staff_role() = 'employee'
    then public.current_staff_member_id() end
$$;

revoke all on function public.current_staff_member_id() from public, anon;
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.is_office_owner() from public, anon;
revoke all on function public.current_employee_id() from public, anon;
grant execute on function public.current_staff_member_id() to authenticated, service_role;
grant execute on function public.current_staff_role() to authenticated, service_role;
grant execute on function public.is_office_owner() to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;

/* =========================================================
   STAFF TABLE POLICIES
   ========================================================= */

alter table public.staff_members enable row level security;
alter table public.timesheet_weeks enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.holiday_requests enable row level security;

-- staff_members: owners manage; everyone can read their own row.
drop policy if exists "staff members owner all" on public.staff_members;
create policy "staff members owner all" on public.staff_members
  for all to authenticated
  using ((select public.is_office_owner()))
  with check ((select public.is_office_owner()));

drop policy if exists "staff members read own" on public.staff_members;
create policy "staff members read own" on public.staff_members
  for select to authenticated
  using (id = (select public.current_staff_member_id()));

-- timesheet_weeks
drop policy if exists "timesheet weeks owner all" on public.timesheet_weeks;
create policy "timesheet weeks owner all" on public.timesheet_weeks
  for all to authenticated
  using ((select public.is_office_owner()))
  with check ((select public.is_office_owner()));

drop policy if exists "timesheet weeks employee read" on public.timesheet_weeks;
create policy "timesheet weeks employee read" on public.timesheet_weeks
  for select to authenticated
  using (staff_id = (select public.current_employee_id()));

drop policy if exists "timesheet weeks employee insert" on public.timesheet_weeks;
create policy "timesheet weeks employee insert" on public.timesheet_weeks
  for insert to authenticated
  with check (
    staff_id = (select public.current_employee_id())
    and status in ('draft', 'submitted')
    and reviewed_at is null and reviewed_by is null
  );

-- Employees can only change a draft/rejected week, and only to draft or submitted.
drop policy if exists "timesheet weeks employee update" on public.timesheet_weeks;
create policy "timesheet weeks employee update" on public.timesheet_weeks
  for update to authenticated
  using (
    staff_id = (select public.current_employee_id())
    and status in ('draft', 'rejected')
  )
  with check (
    staff_id = (select public.current_employee_id())
    and status in ('draft', 'submitted')
  );

-- timesheet_entries: employees edit their own lines while the week is open.
drop policy if exists "timesheet entries owner all" on public.timesheet_entries;
create policy "timesheet entries owner all" on public.timesheet_entries
  for all to authenticated
  using ((select public.is_office_owner()))
  with check ((select public.is_office_owner()));

drop policy if exists "timesheet entries employee read" on public.timesheet_entries;
create policy "timesheet entries employee read" on public.timesheet_entries
  for select to authenticated
  using (staff_id = (select public.current_employee_id()));

drop policy if exists "timesheet entries employee write" on public.timesheet_entries;
create policy "timesheet entries employee write" on public.timesheet_entries
  for all to authenticated
  using (
    staff_id = (select public.current_employee_id())
    and not exists (
      select 1 from public.timesheet_weeks w
      where w.staff_id = timesheet_entries.staff_id
        and w.week_start = timesheet_entries.week_start
        and w.status in ('submitted', 'approved')
    )
  )
  with check (
    staff_id = (select public.current_employee_id())
    and not exists (
      select 1 from public.timesheet_weeks w
      where w.staff_id = timesheet_entries.staff_id
        and w.week_start = timesheet_entries.week_start
        and w.status in ('submitted', 'approved')
    )
  );

-- holiday_requests
drop policy if exists "holiday requests owner all" on public.holiday_requests;
create policy "holiday requests owner all" on public.holiday_requests
  for all to authenticated
  using ((select public.is_office_owner()))
  with check ((select public.is_office_owner()));

drop policy if exists "holiday requests employee read" on public.holiday_requests;
create policy "holiday requests employee read" on public.holiday_requests
  for select to authenticated
  using (staff_id = (select public.current_employee_id()));

drop policy if exists "holiday requests employee insert" on public.holiday_requests;
create policy "holiday requests employee insert" on public.holiday_requests
  for insert to authenticated
  with check (
    staff_id = (select public.current_employee_id())
    and status = 'pending'
    and schedule_event_id is null
    and reviewed_at is null and reviewed_by is null
  );

-- Employees may only cancel their own request while it is still pending.
drop policy if exists "holiday requests employee cancel" on public.holiday_requests;
create policy "holiday requests employee cancel" on public.holiday_requests
  for update to authenticated
  using (
    staff_id = (select public.current_employee_id())
    and status = 'pending'
  )
  with check (
    staff_id = (select public.current_employee_id())
    and status in ('pending', 'cancelled')
    and schedule_event_id is null
  );

/* =========================================================
   OFFICE TABLES: owners only (restrictive)
   ========================================================= */

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not in (
        'staff_members', 'timesheet_weeks', 'timesheet_entries',
        'holiday_requests', 'schedule_events'
      )
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise notice 'Row level security is OFF on public.% – employees are NOT blocked from it at the database level. The app still blocks them.', t;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', 'office owners only', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.is_office_owner())) with check ((select public.is_office_owner()))',
      'office owners only', t
    );
  end loop;
end $$;

-- schedule_events: everyone signed in (and active) may read; only owners write.
do $$
begin
  if to_regclass('public.schedule_events') is null then
    raise notice 'public.schedule_events does not exist – skipped';
    return;
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'schedule_events' and c.relrowsecurity
  ) then
    raise notice 'Row level security is OFF on public.schedule_events – employee writes are only blocked by the app.';
    return;
  end if;

  drop policy if exists "schedule staff read" on public.schedule_events;
  create policy "schedule staff read" on public.schedule_events
    as restrictive for select to authenticated
    using ((select public.current_staff_role()) in ('owner', 'employee'));

  drop policy if exists "schedule owners insert" on public.schedule_events;
  create policy "schedule owners insert" on public.schedule_events
    as restrictive for insert to authenticated
    with check ((select public.is_office_owner()));

  drop policy if exists "schedule owners update" on public.schedule_events;
  create policy "schedule owners update" on public.schedule_events
    as restrictive for update to authenticated
    using ((select public.is_office_owner()))
    with check ((select public.is_office_owner()));

  drop policy if exists "schedule owners delete" on public.schedule_events;
  create policy "schedule owners delete" on public.schedule_events
    as restrictive for delete to authenticated
    using ((select public.is_office_owner()));

  -- Employees need a permissive SELECT policy too. Add one only if the
  -- table has none for authenticated users.
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'schedule_events'
      and p.permissive = 'PERMISSIVE' and p.cmd in ('ALL', 'SELECT')
      and p.roles && array['authenticated', 'public']::name[]
  ) then
    create policy "schedule authenticated read" on public.schedule_events
      for select to authenticated using (true);
  end if;
end $$;

-- Survey report files: owners only.
drop policy if exists "survey reports owners only" on storage.objects;
create policy "survey reports owners only"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (bucket_id <> 'survey-reports' or (select public.is_office_owner()))
  with check (bucket_id <> 'survey-reports' or (select public.is_office_owner()));

notify pgrst, 'reload schema';
