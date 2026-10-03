-- Google Calendar OAuth refresh token.
-- office_settings is readable by every signed-in user, so the refresh
-- token must not be added there. This table has row level security and
-- no policy for anon or authenticated. Only the service role can read it.
--
-- schedule_events.google_calendar_id and google_event_id mirror an event
-- that was read from, or created on, Google. They are nullable. Rows with
-- both null are office-only appointments. The pair is unique together.

create table if not exists public.office_google_oauth (
  id integer primary key default 1,
  refresh_token text,
  calendar_id text,
  family_calendar_id text,
  constraint office_google_oauth_singleton check (id = 1)
);

alter table public.office_google_oauth enable row level security;

revoke all on table public.office_google_oauth from anon, authenticated;
grant select, insert, update, delete on table public.office_google_oauth to service_role;

insert into public.office_google_oauth (id)
values (1)
on conflict (id) do nothing;

alter table public.schedule_events
  add column if not exists google_calendar_id text,
  add column if not exists google_event_id text;

create unique index if not exists schedule_events_google_event_key
  on public.schedule_events (google_calendar_id, google_event_id);
