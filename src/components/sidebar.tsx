import Link from "next/link";
import { logout } from "@/app/actions";

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          DryHome
        </p>

        <h1 className="mt-1 text-xl font-bold">
          Office
        </h1>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        <Link
          href="/"
          className="block rounded-lg bg-slate-800 px-4 py-3 font-medium"
        >
          Dashboard
        </Link>

        <Link
          href="/clients"
          className="block rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Clients
        </Link>

        <Link
          href="/jobs"
          className="block rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Jobs
        </Link>

        <Link
          href="/quotes"
          className="block rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Quotes
        </Link>

        <Link
          href="/invoices"
          className="block rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Invoices
        </Link>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-lg px-4 py-3 text-left text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}