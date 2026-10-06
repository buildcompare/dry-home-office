"use client";

import { useMemo, useState } from "react";

export type JobClientOption = {
  id: string;
  name: string;
  company: string | null;
};

export default function ClientPicker({
  clients,
}: {
  clients: JobClientOption[];
}) {
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle || query === selectedLabel) {
      return [];
    }

    return clients.filter((client) => {
      const haystack = `${client.name} ${client.company ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [clients, query, selectedLabel]);

  function choose(client: JobClientOption) {
    const label = client.company
      ? `${client.name} — ${client.company}`
      : client.name;

    setClientId(client.id);
    setSelectedLabel(label);
    setQuery(label);
    setListOpen(false);
    setBrowseOpen(false);
  }

  return (
    <div className="relative">
      <input
        spellCheck={false}
        type="text"
        name="client_id"
        value={clientId}
        required
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={() => {}}
      />

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            spellCheck={false}
            type="search"
            value={query}
            placeholder="Search clients by name or company"
            autoComplete="off"
            aria-label="Search clients"
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              setListOpen(true);

              if (next !== selectedLabel) {
                setClientId("");
                setSelectedLabel("");
              }
            }}
            onFocus={() => {
              if (query.trim() && query !== selectedLabel) {
                setListOpen(true);
              }
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900"
          />

          {listOpen && query.trim() && query !== selectedLabel && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {matches.length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">
                  No clients found. Use the book to browse everyone.
                </li>
              ) : (
                matches.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => choose(client)}
                      className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="text-slate-900">{client.name}</span>
                      {client.company && (
                        <span className="text-sm text-slate-500">
                          {client.company}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          aria-label="Browse all clients"
          title="Browse all clients"
          onClick={() => setBrowseOpen(true)}
          className="flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <BookIcon />
        </button>
      </div>

      {browseOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/30 p-4 pt-24">
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                All clients
              </h2>
              <button
                type="button"
                onClick={() => setBrowseOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <ul className="overflow-auto">
              {clients.length === 0 ? (
                <li className="px-5 py-4 text-sm text-slate-500">
                  No clients yet.
                </li>
              ) : (
                clients.map((client) => (
                  <li key={client.id} className="border-b border-slate-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => choose(client)}
                      className="flex w-full flex-col px-5 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {client.name}
                      </span>
                      {client.company && (
                        <span className="text-sm text-slate-500">
                          {client.company}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.5c-1.6-1.2-3.6-1.8-6-1.8H4.5V18h1.5c2.4 0 4.4.6 6 1.8 1.6-1.2 3.6-1.8 6-1.8h1.5V4.7H18c-2.4 0-4.4.6-6 1.8z"
      />
      <path strokeLinecap="round" d="M12 6.5V19.8" />
    </svg>
  );
}
