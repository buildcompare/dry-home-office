import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_LAST_UPDATED = "11 October 2026";

export const COMPANY = {
  name: "Dry Home Damp Proofing Solutions Ltd",
  number: "16804053",
  address: "Fullbrook Avenue, Spencers Wood, Reading, Berkshire, RG7 1FE",
  phone: "0118 9740 020",
  email: "Contact@dryhomedampproofing.co.uk",
};

/** Plain public page (no sign-in) used by /privacy and /terms. */
export default function LegalPage({
  title,
  current,
  children,
}: {
  title: string;
  current: "privacy" | "terms";
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <Image
            src="/dryhome-logo-light.png"
            alt="Dry Home Damp Proofing Solutions"
            width={160}
            height={160}
            priority
            className="h-28 w-28 object-contain"
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {LEGAL_LAST_UPDATED}</p>

        <div className="legal mt-8 space-y-8 text-[15px] leading-relaxed [&_a]:text-slate-900 [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:mt-1 [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {COMPANY.name} · Company number {COMPANY.number}
          </p>
          <nav className="flex gap-4">
            {current === "privacy" ? (
              <span className="font-semibold text-slate-900">Privacy Policy</span>
            ) : (
              <Link href="/privacy" className="hover:text-slate-900 hover:underline">
                Privacy Policy
              </Link>
            )}
            {current === "terms" ? (
              <span className="font-semibold text-slate-900">Terms of Use</span>
            ) : (
              <Link href="/terms" className="hover:text-slate-900 hover:underline">
                Terms of Use
              </Link>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function ContactBlock() {
  return (
    <p>
      {COMPANY.name}
      <br />
      {COMPANY.address}
      <br />
      Phone: <a href="tel:01189740020">{COMPANY.phone}</a>
      <br />
      Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
    </p>
  );
}
