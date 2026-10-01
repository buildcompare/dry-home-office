create table if not exists public.office_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.office_todos enable row level security;

drop policy if exists "office todos authenticated" on public.office_todos;

create policy "office todos authenticated"
  on public.office_todos
  for all
  to authenticated
  using (true)
  with check (true);
