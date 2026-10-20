"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Choose your password</h1>
        <p className="mb-4 text-sm text-slate-600">DryHome Office</p>

        {stage === "checking" && <p className="text-sm text-slate-600">Checking your link…</p>}
        {stage === "invalid" && (
          <p className="text-sm text-red-700">
            This link has expired or has already been used. Please ask the office to send a new invite, or{" "}
            <a className="underline" href="/login">sign in</a>.
          </p>
        )}
        {(stage === "ready" || stage === "saving") && (
          <form onSubmit={save} className="space-y-3">
            <input type="password" autoComplete="new-password" placeholder="New password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} />
            <input type="password" autoComplete="new-password" placeholder="Confirm password" className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} spellCheck={false} />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button disabled={stage === "saving"} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {stage === "saving" ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
        {stage === "done" && <p className="text-sm text-emerald-700">Password saved. Signing you in…</p>}
      </div>
    </div>
  );
}
