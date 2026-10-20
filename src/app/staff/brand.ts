/* DryHome brand tokens for the staff portal (match the office app). */
export const BRAND = { red: "#be1e2d", gold: "#f29e23", charcoal: "#252525" };

export const card = "rounded-2xl bg-white p-5 shadow-sm";
export const input =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#f29e23]/40";
export const label = "block text-sm font-medium text-slate-700 [&>*]:mt-1.5";
export const btnPrimary =
  "rounded-xl bg-[#be1e2d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a31926]";
export const btnDark =
  "rounded-xl bg-[#252525] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black";
export const btnGhost =
  "rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#252525] shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50";
export const btnDanger =
  "rounded-lg px-3 py-1.5 text-sm font-semibold text-[#be1e2d] transition hover:bg-[#be1e2d]/10";
export const btnLink = "rounded-lg px-3 py-1.5 text-sm font-semibold text-[#252525] transition hover:bg-slate-100";
export const eyebrow = "text-xs font-semibold uppercase tracking-[0.2em] text-[#be1e2d]";
export const h1 = "mt-1 text-3xl font-bold text-[#252525]";

export const BRAND_STATUS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  submitted: "bg-[#f29e23]/15 text-[#8a5300] ring-[#f29e23]/40",
  pending: "bg-[#f29e23]/15 text-[#8a5300] ring-[#f29e23]/40",
  approved: "bg-[#252525] text-white ring-[#252525]",
  rejected: "bg-[#be1e2d]/10 text-[#be1e2d] ring-[#be1e2d]/30",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};
