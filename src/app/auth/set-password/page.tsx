"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Stage = "checking" | "ready" | "invalid" | "saving" | "done";

/*
 * Landing page for staff invite (and password recovery) emails. Handles
 * the three link styles Supabase can send: #access_token in the hash,
 * ?code (PKCE) and ?token_hash. Then the user chooses a password.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function start() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === "recovery" ? "recovery" : "invite",
          });
        }

        window.history.replaceState(null, "", url.pathname);
      } catch {
        // The client may already have used the link itself; checked below.
      }
      // Whichever way the link was handled, a signed-in user can continue.
      const { data } = await supabase.auth.getUser();
      setStage(data.user ? "ready" : "invalid");
    }
    void start();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Please use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setStage("saving");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("The password couldn't be saved. Please try a different one.");
      setStage("ready");
      return;
    }
    setStage("done");
    router.replace("/");
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="h-1.5 bg-[#be1e2d]" />
        <div className="p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/dryhome-logo-light.png"
            alt="Dry Home Damp Proofing Solutions"
            width={160}
            height={160}
            priority
            className="h-28 w-28 object-contain"
          />
          <h1 className="mt-2 text-2xl font-bold text-[#252525]">Choose your password</h1>
          <p className="mt-1 text-sm text-slate-500">DryHome staff account</p>
        </div>

        {stage === "checking" && <p className="text-center text-sm text-slate-600">Checking your link…</p>}
        {stage === "invalid" && (
          <p className="text-sm font-medium text-[#be1e2d]">
            This link has expired or has already been used. Please ask the office to send a new invite, or{" "}
            <a className="font-semibold underline" href="/login">sign in</a>.
          </p>
        )}
        {(stage === "ready" || stage === "saving") && (
          <form onSubmit={save} className="space-y-4">
            <input type="password" autoComplete="new-password" placeholder="New password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} />
            <input type="password" autoComplete="new-password" placeholder="Confirm password" className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} spellCheck={false} />
            {error && <p className="text-sm font-medium text-[#be1e2d]">{error}</p>}
            <button disabled={stage === "saving"} className="w-full rounded-xl bg-[#be1e2d] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#a31926] disabled:opacity-60">
              {stage === "saving" ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
        {stage === "done" && <p className="text-center text-sm font-medium text-[#252525]">Password saved. Signing you in…</p>}
        <p className="mt-8 text-center text-xs text-slate-400">DryHome Damp Proofing Solutions</p>
        </div>
      </div>
    </main>
  );
}
