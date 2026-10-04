"use client";

import { useRef } from "react";

import { importClients } from "./csv-actions";

export default function ImportClientsButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={importClients}>
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Import
      </button>
    </form>
  );
}
