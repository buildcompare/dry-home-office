"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Todo = {
  id: string;
  title: string;
  done: boolean;
};

export default function SidebarTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("office_todos")
      .select("id, title, done")
      .eq("done", false)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      setSetupNeeded(true);
      return;
    }

    setSetupNeeded(false);
    setTodos(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("office_todos").insert({ title: next });
    setSaving(false);

    if (error) {
      setSetupNeeded(true);
      return;
    }

    setTitle("");
    await load();
  }

  async function complete(id: string) {
    const supabase = createClient();
    await supabase
      .from("office_todos")
      .update({ done: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-900/70 px-3 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          To-do
        </p>
        <Link href="/todos" className="text-xs font-semibold text-slate-400 hover:text-white">
          All
        </Link>
      </div>

      {setupNeeded ? (
        <Link href="/todos" className="block px-1 text-xs leading-5 text-amber-300 hover:text-amber-200">
          One-time setup needed. Open To-do to finish it.
        </Link>
      ) : (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input
              spellCheck
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Jot something down"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-60"
            >
              Add
            </button>
          </form>

          <div className="mt-3 space-y-1">
            {todos.length === 0 ? (
              <p className="px-1 text-xs text-slate-500">Nothing waiting.</p>
            ) : (
              todos.map((todo) => (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => complete(todo.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-500" />
                  <span className="line-clamp-2">{todo.title}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
