import Link from "next/link";
import { logout } from "@/app/actions";

const links = [
  { href: "/staff/timesheet", label: "Timesheet" },
  { href: "/staff/holiday", label: "Holiday" },
  { href: "/staff/schedule", label: "Schedule" },
];

export const metadata = { title: "DryHome Staff" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-bold text-slate-900">DryHome Staff</p>
          <form action={logout}>
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
