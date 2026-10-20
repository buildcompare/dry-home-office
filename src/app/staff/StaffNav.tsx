"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/staff/timesheet", label: "Timesheets" },
  { href: "/staff/holiday", label: "Holiday" },
  { href: "/staff/schedule", label: "Schedule" },
];

export default function StaffNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto grid max-w-4xl grid-cols-3 gap-1 px-3 pb-3 sm:flex sm:px-4" aria-label="Staff">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-xs sm:px-4 font-semibold uppercase tracking-wider transition ${
              active ? "bg-white text-[#252525]" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
