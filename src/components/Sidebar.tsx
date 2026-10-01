"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import SidebarTodos from "@/components/SidebarTodos";

const mainNavItems = [
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
  {
    label: "Reports",
    href: "/reports",
  },
];

const settingsNavItems = [
  {
    label: "Email Templates",
    href: "/settings/email-templates",
  },
  {
    label: "Numbering",
    href: "/settings/numbering",
  },
];

export default function Sidebar() {
  const pathname =
    usePathname();

  const settingsActive =
    pathname.startsWith("/settings");

  const [settingsOpen, setSettingsOpen] =
    useState(settingsActive);

  const [menuOpen, setMenuOpen] =
    useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    const supabase =
      createClient();

    await supabase.auth.signOut();

    window.location.href =
      "/login";
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold"
          aria-label="Open menu"
        >
          Menu
        </button>
        <span className="text-sm font-semibold tracking-[0.2em] text-slate-300">
          OFFICE
        </span>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
        />
      )}

    <aside className={`fixed inset-y-0 left-0 z-50 flex min-h-screen w-64 flex-col bg-slate-950 px-4 py-6 text-white transition-transform lg:static lg:z-auto lg:translate-x-0 ${
      menuOpen ? "translate-x-0" : "-translate-x-full"
    }`}>

      {/* LOGO */}

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

      {/* MAIN NAVIGATION */}

      <nav className="flex-1">
        <div className="space-y-2">
          {mainNavItems.map(
            (item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(
                      item.href
                    );

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={`block rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {
                    item.label
                  }
                </Link>
              );
            }
          )}
          <SidebarTodos />
        </div>

        {/* SETTINGS */}

        <div className="mt-8 border-t border-slate-800 pt-6">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${
              settingsActive
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <CogIcon />
            <span className="flex-1 text-left">Settings</span>
            <span className="text-xs">{settingsOpen ? "−" : "+"}</span>
          </button>

          {settingsOpen && (
            <div className="mt-2 space-y-1 pl-4">
              {settingsNavItems.map((item) => {
                const active = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* SIGN OUT */}

      <button
        type="button"
        onClick={
          signOut
        }
        className="mt-6 rounded-lg border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Sign Out
      </button>
    </aside>
    </>
  );
}

function CogIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 3.6h3.4l.5 2.1a7.8 7.8 0 0 1 1.8 1.1l2-.8 1.7 2.9-1.5 1.3a7.6 7.6 0 0 1 0 2.1l1.5 1.3-1.7 2.9-2-.8a7.8 7.8 0 0 1-1.8 1.1l-.5 2.1h-3.4l-.5-2.1a7.8 7.8 0 0 1-1.8-1.1l-2 .8-1.7-2.9 1.5-1.3a7.6 7.6 0 0 1 0-2.1L4.3 8.9l1.7-2.9 2 .8a7.8 7.8 0 0 1 1.8-1.1l.5-2.1Z"
      />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
