import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { saveNumbering } from "./actions";

const defaults = {
  quote_prefix: "Q-",
  invoice_prefix: "INV-",
  contract_prefix: "C-",
  guarantee_prefix: "G-",
  job_prefix: "JOB-",
  quote_next: 1001,
  invoice_next: 1001,
  contract_next: 1001,
  guarantee_next: 1001,
  job_next: 1001,
};

const setupSql = `create table if not exists public.office_settings (
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

create policy "office settings authenticated"
  on public.office_settings
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.office_settings (id)
values (1)
on conflict (id) do nothing;`;

export default async function NumberingSettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("office_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings = { ...defaults, ...(data ?? {}) };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-slate-500">Settings</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Numbering</h1>
          <p className="mt-2 text-slate-500">
            Prefix and next number for quotes, invoices, contracts, guarantees and jobs.
            The next document uses the next number, then it moves on by one.
          </p>

          {error ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-950">One-time setup</h2>
              <p className="mt-2 text-sm text-amber-900">
                Run this in the Supabase SQL editor, then refresh.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {setupSql}
              </pre>
            </section>
          ) : (
            <form action={saveNumbering} className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
              {(
                [
                  ["Quotes", "quote_prefix", "quote_next"],
                  ["Invoices", "invoice_prefix", "invoice_next"],
                  ["Contracts", "contract_prefix", "contract_next"],
                  ["Guarantees", "guarantee_prefix", "guarantee_next"],
                  ["Jobs", "job_prefix", "job_next"],
                ] as const
              ).map(([label, prefixKey, nextKey]) => (
                <div key={label} className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-[140px_1fr_140px] sm:items-end">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <label className="block text-sm text-slate-600">
                    Prefix
                    <input
                      spellCheck={false}
                      name={prefixKey}
                      defaultValue={settings[prefixKey]}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </label>
                  <label className="block text-sm text-slate-600">
                    Next number
                    <input
                      spellCheck={false}
                      name={nextKey}
                      type="number"
                      min="1"
                      defaultValue={settings[nextKey]}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </label>
                </div>
              ))}
              <p className="text-sm text-slate-500">
                Example: prefix INV- and next number 1001 becomes INV-1001.
              </p>
              <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                Save numbering
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
