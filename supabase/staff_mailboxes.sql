-- Work mailboxes (SiteGround IMAP/SMTP) for the Email tab.
-- Each signed-in user can only see and change THEIR OWN row. Owners get
-- no access to anyone else's row, so James cannot read employees' mail.
-- The mailbox password is stored encrypted (AES-256-GCM) by the app with
-- the MAIL_CREDENTIALS_KEY env var; the database never sees it in plain text.
-- Safe to re-run. Run after supabase/staff_portal.sql.

create table if not exists public.mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  email text not null,
  imap_host text not null,
  imap_port integer not null default 993 check (imap_port between 1 and 65535),
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port integer not null default 465 check (smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  secret_ciphertext text not null,
  secret_iv text not null,
  secret_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mailbox_connections enable row level security;

revoke all on public.mailbox_connections from anon;
grant select, insert, update, delete on public.mailbox_connections to authenticated;

-- In case staff_portal.sql was re-run before its exclusion list knew this table.
drop policy if exists "office owners only" on public.mailbox_connections;

drop policy if exists "mailbox own select" on public.mailbox_connections;
create policy "mailbox own select" on public.mailbox_connections
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mailbox own insert" on public.mailbox_connections;
create policy "mailbox own insert" on public.mailbox_connections
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "mailbox own update" on public.mailbox_connections;
create policy "mailbox own update" on public.mailbox_connections
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "mailbox own delete" on public.mailbox_connections;
create policy "mailbox own delete" on public.mailbox_connections
  for delete to authenticated using (user_id = (select auth.uid()));

-- Deactivated staff logins can't use a stored mailbox.
do $$
begin
  if to_regprocedure('public.current_staff_role()') is not null then
    drop policy if exists "mailbox active staff only" on public.mailbox_connections;
    create policy "mailbox active staff only" on public.mailbox_connections
      as restrictive for all to authenticated
      using ((select public.current_staff_role()) in ('owner', 'employee'))
      with check ((select public.current_staff_role()) in ('owner', 'employee'));
  end if;
end $$;

notify pgrst, 'reload schema';
