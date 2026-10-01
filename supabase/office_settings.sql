create table if not exists public.office_settings (
  id integer primary key default 1,
  quote_prefix text not null default 'Q-',
  invoice_prefix text not null default 'INV-',
  contract_prefix text not null default 'C-',
  guarantee_prefix text not null default 'G-',
  job_prefix text not null default 'JOB-',
  quote_next integer not null default 1001,
  invoice_next integer not null default 1001,
  contract_next integer not null default 1001,
  guarantee_next integer not null default 1001,
  job_next integer not null default 1001,
  constraint office_settings_singleton check (id = 1)
);

alter table public.office_settings enable row level security;

drop policy if exists "office settings authenticated" on public.office_settings;
create policy "office settings authenticated"
  on public.office_settings
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.office_settings (id)
values (1)
on conflict (id) do nothing;
