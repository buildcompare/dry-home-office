"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
  },
  {
    label: "Clients",
    href: "/clients",
  },
  {
    label: "Jobs",
    href: "/jobs",
  },
  {
    label: "Schedule",
    href: "/schedule",
  },
  {
    label: "Quotes",
    href: "/quotes",
  },
  {
    label: "Contracts",
    href: "/contracts",
  },
  {
    label: "Invoices",
    href: "/invoices",
  },
  {
    label: "Guarantees",
    href: "/guarantees",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function signOut() {
    const supabase =
      createClient();

    await supabase.auth.signOut();

    window.location.href =
      "/login";
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 px-4 py-6 text-white">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Image
          src="/dryhome-logo.png"
          alt="Dry Home Damp Proofing Solutions"
          width={120}
          height={50}
          className="h-auto w-28 object-contain"
          priority
        />

        <span className="text-sm font-semibold tracking-[0.25em] text-slate-300">
          OFFICE
        </span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map(
          (item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(
                    item.href
                  );

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          }
        )}
      </nav>

      <button
        type="button"
        onClick={signOut}
        className="mt-6 rounded-lg border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Sign Out
      </button>
    </aside>
  );
}