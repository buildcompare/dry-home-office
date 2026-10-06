import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { addTodo, deleteTodo, toggleTodo } from "@/app/todos/actions";
import { formatShortDate } from "@/lib/dates";

const setupSql = `create table if not exists public.office_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.office_todos enable row level security;

create policy "office todos authenticated"
  on public.office_todos
  for all
  to authenticated
  using (true)
  with check (true);`;

export default async function TodosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("office_todos")
    .select("id, title, done, created_at, completed_at")
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  const todos = data ?? [];
  const open = todos.filter((todo) => !todo.done);
  const done = todos.filter((todo) => todo.done);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-slate-500">
            Dry Home Damp Proofing Solutions
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">To-do</h1>
          <p className="mt-2 text-slate-500">
            Quick notes to come back to when you are ready.
          </p>

          {!error && (
            <form action={addTodo} className="mt-6 flex gap-3">
              <input
                spellCheck
                name="title"
                placeholder="Jot something down"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-500"
              />
              <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                Add
              </button>
            </form>
          )}

          {error ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-950">
                One-time setup needed
              </h2>
              <p className="mt-2 text-sm text-amber-900">
                Run this once in the Supabase SQL editor, then refresh this page.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {setupSql}
              </pre>
            </section>
          ) : (
            <>
              <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Open ({open.length})
                  </h2>
                </div>
                {open.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">
                    Nothing waiting. Add a note above.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {open.map((todo) => (
                      <li
                        key={todo.id}
                        className="flex items-center justify-between gap-4 px-6 py-4"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{todo.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Added {formatShortDate(todo.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <form action={toggleTodo}>
                            <input type="hidden" name="id" value={todo.id} />
                            <input type="hidden" name="done" value="false" />
                            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                              Done
                            </button>
                          </form>
                          <form action={deleteTodo}>
                            <input type="hidden" name="id" value={todo.id} />
                            <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
                              Delete
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Done ({done.length})
                  </h2>
                </div>
                {done.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">Nothing completed yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {done.map((todo) => (
                      <li
                        key={todo.id}
                        className="flex items-center justify-between gap-4 px-6 py-4"
                      >
                        <p className="text-slate-400 line-through">{todo.title}</p>
                        <form action={toggleTodo}>
                          <input type="hidden" name="id" value={todo.id} />
                          <input type="hidden" name="done" value="true" />
                          <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
                            Reopen
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
