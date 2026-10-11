-- Activity log for the Dashboard "Recent activity" card and /activity.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Until this has been run the app still works: the feed is built from
-- existing timestamps (sent_at, viewed_at, accepted_at, signed_at,
-- paid_at, created_at …) and logging is silently skipped.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  record_type text,
  record_id text,
  record_number text,
  client_id text,
  client_name text,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_created_at_idx
  on public.activity_events (created_at desc);

create index if not exists activity_events_record_idx
  on public.activity_events (record_type, record_id, event_type, created_at desc);

create index if not exists activity_events_client_idx
  on public.activity_events (client_id, created_at desc);

-- Lets Resend webhook events find the email they belong to.
create index if not exists activity_events_resend_id_idx
  on public.activity_events ((metadata ->> 'resend_id'));

alter table public.activity_events enable row level security;

-- Signed-in office users: read the feed and log events from the app.
drop policy if exists "activity events authenticated select" on public.activity_events;
create policy "activity events authenticated select"
  on public.activity_events
  for select
  to authenticated
  using (true);

drop policy if exists "activity events authenticated insert" on public.activity_events;
create policy "activity events authenticated insert"
  on public.activity_events
  for insert
  to authenticated
  with check (true);

-- Public token pages (/q, /c, /i, /g, /v) and the Resend webhook log
-- through the server-side service role key. The service role bypasses
-- RLS anyway; this policy just makes that explicit. Anonymous users
-- get no access at all.
drop policy if exists "activity events service role" on public.activity_events;
create policy "activity events service role"
  on public.activity_events
  for all
  to service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';
