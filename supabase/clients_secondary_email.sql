-- Optional second email address for a client.
-- Customer emails (quotes, contracts, invoices, guarantees, variations)
-- are sent to both the main and the secondary email when it is set.
-- Additive only: existing client rows are not changed.

alter table public.clients
  add column if not exists secondary_email text;

-- Make PostgREST pick up the new column straight away.
notify pgrst, 'reload schema';
