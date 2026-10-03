-- Secret Google Calendar iCal links.
-- office_settings is readable by every signed-in user, so these URLs
-- must not be added there. This table has row level security and no
-- policy for anon or authenticated. Only the service role can read it.

create table if not exists public.office_calendar_feeds (
  id integer primary key default 1,
  work_ics_url text,
  family_ics_url text,
  constraint office_calendar_feeds_singleton check (id = 1)
);

alter table public.office_calendar_feeds enable row level security;

revoke all on table public.office_calendar_feeds from anon, authenticated;
grant select, insert, update, delete on table public.office_calendar_feeds to service_role;

insert into public.office_calendar_feeds (id)
values (1)
on conflict (id) do nothing;
