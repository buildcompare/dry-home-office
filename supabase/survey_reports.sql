-- Survey reports (PDFs) attached to survey jobs.
--
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- 1. Private Storage bucket "survey-reports": PDF only, 25 MB max.
-- 2. Table public.survey_reports: one row per uploaded report.
-- 3. Row level security: signed-in office users only (same pattern as
--    office_settings / office_todos). Nothing is readable by anon; the
--    customer only ever gets a time-limited signed link or an attachment.

/* ---------------------------------------------------------
   STORAGE BUCKET
   --------------------------------------------------------- */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('survey-reports', 'survey-reports', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "survey reports authenticated select" on storage.objects;
create policy "survey reports authenticated select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'survey-reports');

drop policy if exists "survey reports authenticated insert" on storage.objects;
create policy "survey reports authenticated insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'survey-reports');

drop policy if exists "survey reports authenticated update" on storage.objects;
create policy "survey reports authenticated update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'survey-reports')
  with check (bucket_id = 'survey-reports');

drop policy if exists "survey reports authenticated delete" on storage.objects;
create policy "survey reports authenticated delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'survey-reports');

/* ---------------------------------------------------------
   TABLE
   --------------------------------------------------------- */

create table if not exists public.survey_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  client_id uuid,
  file_path text not null,
  file_name text not null,
  title text,
  size_bytes integer,
  uploaded_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_to text
);

create index if not exists survey_reports_job_id_idx
  on public.survey_reports (job_id);

alter table public.survey_reports enable row level security;

drop policy if exists "survey reports authenticated" on public.survey_reports;
create policy "survey reports authenticated"
  on public.survey_reports
  for all
  to authenticated
  using (true)
  with check (true);

-- Make PostgREST pick up the new table straight away.
notify pgrst, 'reload schema';
