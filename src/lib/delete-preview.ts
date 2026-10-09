/*
 * Shared shapes and pure helpers for the delete confirm dialog.
 * Safe to import from client components.
 */

export type DeleteKind =
  | "job"
  | "survey"
  | "client"
  | "quote"
  | "contract"
  | "invoice"
  | "guarantee"
  | "variation";

export const DELETE_KINDS: DeleteKind[] = [
  "job",
  "survey",
  "client",
  "quote",
  "contract",
  "invoice",
  "guarantee",
  "variation",
];

export type DeleteConfirm =
  | { mode: "none" }
  | { mode: "tick"; label: string }
  | { mode: "type"; text: string; label: string };

export type DeletePreview =
  | {
      ok: true;
      kind: DeleteKind;
      id: string;
      name: string;
      heading: string;
      warning: string;
      notes: string[];
      summary: { label: string; items: string[] }[];
      confirm: DeleteConfirm;
      blocked: string | null;
      token: string;
      submitLabel: string;
    }
  | { ok: false; error: string };

export type DeleteState = { error: string | null };

export function normaliseConfirmText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function confirmSatisfied(
  confirm: DeleteConfirm,
  input: { ticked: boolean; typed: string }
) {
  if (confirm.mode === "none") return true;
  if (confirm.mode === "tick") return input.ticked;
  return (
    normaliseConfirmText(input.typed) !== "" &&
    normaliseConfirmText(input.typed) === normaliseConfirmText(confirm.text)
  );
}

export function isDeleteKind(value: string): value is DeleteKind {
  return (DELETE_KINDS as string[]).includes(value);
}
