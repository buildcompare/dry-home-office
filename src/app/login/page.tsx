import Image from "next/image";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="h-1.5 bg-[#be1e2d]" />
        <div className="p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/dryhome-logo-light.png"
            alt="Dry Home Damp Proofing Solutions"
            width={160}
            height={160}
            priority
            className="h-28 w-28 object-contain"
          />

          <h1 className="mt-2 text-3xl font-bold text-[#252525]">
            DryHome Office
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage your clients and jobs
          </p>
        </div>

        {params.error && (
          <div className="mb-5 rounded-lg border-l-4 border-[#be1e2d] bg-[#be1e2d]/5 px-4 py-3 text-sm font-medium text-[#be1e2d]">
            {params.error}
          </div>
        )}

        <form action={login} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              spellCheck={false}
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <input
              spellCheck={false}
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#be1e2d] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a31926]"
          >
            Sign in
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          DryHome Damp Proofing Solutions
        </p>
        </div>
      </div>
    </main>
  );
}