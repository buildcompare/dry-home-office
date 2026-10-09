-- Delete permissions for the office "Delete" buttons.
--
-- Only needed if a delete in the app stops with
--   'Supabase row level security blocked deleting from the "<table>" table'
-- but it is safe to run at any time and safe to run again: for each
-- office table that has row level security turned on and NO policy yet
-- that lets signed-in users delete (FOR ALL or FOR DELETE), it adds one,
-- for authenticated users only (the same pattern as office_settings /
-- office_todos). Tables that already allow it are left alone.
--
-- invoices, guarantees and schedule_events also get an UPDATE policy the
-- same way, because deleting a contract/invoice clears links on them.

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'jobs', 'quotes', 'quote_items', 'variations', 'variation_items',
    'contracts', 'invoices', 'invoice_items', 'invoice_payments', 'guarantees',
    'schedule_events', 'survey_reports'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'Skipping %: table does not exist', t;
      continue;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise notice 'Skipping %: row level security is off', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = t
        and p.permissive = 'PERMISSIVE'
        and p.cmd in ('ALL', 'DELETE')
        and p.roles && array['authenticated', 'public']::name[]
    ) then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (true)',
        t || ' authenticated delete', t
      );
      raise notice 'Added delete policy on %', t;
    end if;

    if t in ('invoices', 'guarantees', 'schedule_events') and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = t
        and p.permissive = 'PERMISSIVE'
        and p.cmd in ('ALL', 'UPDATE')
        and p.roles && array['authenticated', 'public']::name[]
    ) then
      execute format(
        'create policy %I on public.%I for update to authenticated using (true) with check (true)',
        t || ' authenticated update', t
      );
      raise notice 'Added update policy on %', t;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
