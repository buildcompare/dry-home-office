import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions";

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 text-white">
      {/* Logo */}
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/dryhome-logo.png"
            alt="DryHome Damp Proofing Solutions"
            width={170}
            height={170}
            className="h-auto w-auto"
            priority
          />

          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">
            Office
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-6">
        <Link
          href="/"
          className="block rounded-lg bg-slate-800 px-4 py-3 font-medium text-white"
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
          href="/schedule"
          className="block rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Schedule
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

      {/* Sign Out */}
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