import Image from "next/image";
import Link from "next/link";
import StaffNav from "@/app/staff/StaffNav";
import { logout } from "@/app/actions";

export const metadata = { title: "DryHome Staff" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b-4 border-[#f29e23] bg-[#252525] text-white shadow">
        <div className="relative mx-auto flex max-w-4xl items-center justify-center px-4 pb-2 pt-4">
          <Link href="/staff" className="flex flex-col items-center">
            {/* Same crop as the office sidebar: the PNG mark sits in y 152–348 of 500. */}
            <div className="h-[calc(9rem*197/500)] w-36 overflow-hidden">
              <Image
                src="/dryhome-logo.png"
                alt="Dry Home Damp Proofing Solutions"
                width={500}
                height={500}
                priority
                className="h-36 w-36 max-w-none object-cover object-center"
                style={{ marginTop: "calc(9rem * -152 / 500)" }}
              />
            </div>
            <span className="mt-1 text-center text-[11px] font-semibold tracking-[0.25em] text-slate-300">STAFF</span>
          </Link>
          <form action={logout} className="absolute right-3 top-4 sm:right-4">
            <button className="rounded-lg border border-white/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
        <StaffNav />
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
