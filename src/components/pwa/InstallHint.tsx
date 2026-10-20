"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "dryhome-install-hint-dismissed";

/** Dismissible "Install app" hint: Android/desktop install button, or iOS Add to Home Screen steps. */
export default function InstallHint({ tone = "light" }: { tone?: "light" | "brand" }) {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const timer = ios ? window.setTimeout(() => setMode("ios"), 0) : undefined;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("hidden");
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
    setMode("hidden");
  };

  return (
    <div
      className={`mb-6 flex items-center gap-3 rounded-2xl border-l-4 border-[#f29e23] p-4 shadow-sm ${
        tone === "brand" ? "bg-[#252525] text-white" : "bg-white text-[#252525]"
      }`}
      role="region"
      aria-label="Install app"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Install DryHome on this device</p>
        {mode === "ios" ? (
          <p className={tone === "brand" ? "text-slate-300" : "text-slate-500"}>
            Tap <strong>Share</strong> <span aria-hidden>⎋</span> then <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className={tone === "brand" ? "text-slate-300" : "text-slate-500"}>Open it from your home screen like an app.</p>
        )}
      </div>
      {mode === "prompt" && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-xl bg-[#be1e2d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a31926]"
        >
          Install app
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={`shrink-0 rounded-lg px-2 py-1 text-lg leading-none ${tone === "brand" ? "text-slate-300 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100"}`}
      >
        ×
      </button>
    </div>
  );
}
