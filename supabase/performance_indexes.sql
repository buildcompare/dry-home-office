-- Performance indexes for DryHome Office (staff portal + office app).
--
-- Safe to run more than once: every index uses IF NOT EXISTS, and each one
-- is skipped if its table or columns don't exist in this database. Indexes
-- only speed up reads; they don't change any data or permissions.
-- Run in the Supabase SQL editor.

create or replace function pg_temp.dryhome_index(idx text, tbl text, cols text[], expr text)
returns void
language plpgsql
as $$
declare
  col text;
begin
  if to_regclass('public.' || tbl) is null then
    raise notice 'skipped % (no table %)', idx, tbl;
    return;
  end if;
  foreach col in array cols loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = col
    ) then
      raise notice 'skipped % (no column %.%)', idx, tbl, col;
      return;
    end if;
  end loop;
  execute format('create index if not exists %I on public.%I %s', idx, tbl, expr);
end
$$;

-- Staff portal ------------------------------------------------------------
-- Owner "waiting for approval" queue and per-employee week lookups.
select pg_temp.dryhome_index('timesheet_weeks_status_week_idx', 'timesheet_weeks', array['status','week_start'], '(status, week_start desc)');
-- Dashboards read every entry for one employee by date.
select pg_temp.dryhome_index('timesheet_entries_staff_date_idx', 'timesheet_entries', array['staff_id','work_date'], '(staff_id, work_date)');
-- Owner holiday list (pending first) and overlap checks.
select pg_temp.dryhome_index('holiday_requests_status_start_idx', 'holiday_requests', array['status','start_date'], '(status, start_date desc)');
select pg_temp.dryhome_index('holiday_requests_staff_status_idx', 'holiday_requests', array['staff_id','status','start_date'], '(staff_id, status, start_date)');
-- Role lookups by login (user_id is already unique; email is matched lower-cased).
select pg_temp.dryhome_index('staff_members_role_active_idx', 'staff_members', array['role','active'], '(role, active)');

-- Schedule (office + staff Schedule page: date ranges) ----------------------
select pg_temp.dryhome_index('schedule_events_start_idx', 'schedule_events', array['start_date'], '(start_date)');
select pg_temp.dryhome_index('schedule_events_job_idx', 'schedule_events', array['job_id'], '(job_id)');

-- Office records: lookups by client / job / quote and status ---------------
select pg_temp.dryhome_index('jobs_client_idx', 'jobs', array['client_id'], '(client_id)');
select pg_temp.dryhome_index('jobs_status_idx', 'jobs', array['status'], '(status)');
select pg_temp.dryhome_index('quotes_client_idx', 'quotes', array['client_id'], '(client_id)');
select pg_temp.dryhome_index('quotes_job_idx', 'quotes', array['job_id'], '(job_id)');
select pg_temp.dryhome_index('quotes_created_idx', 'quotes', array['created_at'], '(created_at desc)');
select pg_temp.dryhome_index('quote_items_quote_idx', 'quote_items', array['quote_id'], '(quote_id)');
select pg_temp.dryhome_index('invoices_client_idx', 'invoices', array['client_id'], '(client_id)');
select pg_temp.dryhome_index('invoices_job_idx', 'invoices', array['job_id'], '(job_id)');
select pg_temp.dryhome_index('invoices_status_due_idx', 'invoices', array['status','due_date'], '(status, due_date)');
select pg_temp.dryhome_index('invoice_items_invoice_idx', 'invoice_items', array['invoice_id'], '(invoice_id)');
select pg_temp.dryhome_index('invoice_payments_invoice_idx', 'invoice_payments', array['invoice_id'], '(invoice_id)');
select pg_temp.dryhome_index('contracts_job_idx', 'contracts', array['job_id'], '(job_id)');
select pg_temp.dryhome_index('contracts_quote_idx', 'contracts', array['quote_id'], '(quote_id)');
select pg_temp.dryhome_index('guarantees_job_idx', 'guarantees', array['job_id'], '(job_id)');
select pg_temp.dryhome_index('variations_job_idx', 'variations', array['job_id'], '(job_id)');
select pg_temp.dryhome_index('office_todos_created_idx', 'office_todos', array['created_at'], '(created_at desc)');

-- Refresh planner statistics so the new indexes are used straight away.
analyze;
