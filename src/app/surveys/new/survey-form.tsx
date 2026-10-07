"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";

import { bookSurvey } from "../actions";
import { buildRecipientList, describeRecipients } from "@/lib/email-recipients";
import {
  DEFAULT_SURVEY_MINUTES,
  addMinutesToTime,
  formatAddress,
  searchClients,
  suggestedNameFromQuery,
  type BookSurveyState,
  type SurveyClientOption,
} from "@/lib/survey";

const initialState: BookSurveyState = {
  error: null,
};

const emptyNewClient = {
  name: "",
  email: "",
  secondaryEmail: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  town: "",
  county: "",
  postcode: "",
};

const emptySite = {
  addressLine1: "",
  addressLine2: "",
  town: "",
  county: "",
  postcode: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-900";

export default function SurveyForm({
  clients,
}: {
  clients: SurveyClientOption[];
}) {
  const [state, formAction, pending] = useActionState(bookSurvey, initialState);

  /* ---------------- client ---------------- */

  const [knownClients, setKnownClients] = useState(clients);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SurveyClientOption | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newClient, setNewClient] = useState(emptyNewClient);
  const searchRef = useRef<HTMLInputElement>(null);

  /*
   * If a new client was saved but the booking stopped, select that
   * client so it is not added twice on the next attempt.
   */
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);

    if (state.newClient) {
      const saved = state.newClient;
      setKnownClients((current) =>
        current.some((client) => client.id === saved.id)
          ? current
          : [saved, ...current]
      );
      setSelected(saved);
      setAddingNew(false);
      setNewClient(emptyNewClient);
      setQuery("");
    }
  }

  const matches = useMemo(
    () => searchClients(knownClients, query),
    [knownClients, query]
  );

  function chooseClient(client: SurveyClientOption) {
    setSelected(client);
    setAddingNew(false);
    setQuery("");
    setLocalError(null);
  }

  function startNewClient() {
    setAddingNew(true);
    setSelected(null);
    setNewClient({
      ...emptyNewClient,
      name: suggestedNameFromQuery(query),
    });
    setLocalError(null);
  }

  function backToSearch() {
    setAddingNew(false);
    setSelected(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  /* The client details the rest of the form works from. */
  const activeClient = selected
    ? {
        email: selected.email,
        secondaryEmail: selected.secondaryEmail,
        address: {
          address_line_1: selected.addressLine1,
          address_line_2: selected.addressLine2,
          town: selected.town,
          county: selected.county,
          postcode: selected.postcode,
        },
      }
    : addingNew
      ? {
          email: newClient.email,
          secondaryEmail: newClient.secondaryEmail,
          address: {
            address_line_1: newClient.addressLine1,
            address_line_2: newClient.addressLine2,
            town: newClient.town,
            county: newClient.county,
            postcode: newClient.postcode,
          },
        }
      : null;

  /* ---------------- address ---------------- */

  const [differentAddress, setDifferentAddress] = useState(false);
  const [site, setSite] = useState(emptySite);
  const clientAddress = formatAddress(activeClient?.address);

  /* ---------------- date + time ---------------- */

  const [surveyDate, setSurveyDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endEdited, setEndEdited] = useState(false);

  /* ---------------- fee, notes, email ---------------- */

  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const recipients = activeClient
    ? buildRecipientList(activeClient.email, activeClient.secondaryEmail)
    : [];

  const error = localError || state.error;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!selected && !addingNew) {
          event.preventDefault();
          setLocalError("Please search for and choose a client, or add a new client.");
          searchRef.current?.focus();
          return;
        }

        setLocalError(null);
      }}
      className="space-y-5 md:space-y-6"
    >
      <input type="hidden" name="client_mode" value={addingNew ? "new" : "existing"} />
      <input type="hidden" name="client_id" value={selected?.id ?? ""} />

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =================================================
          1. CLIENT
          ================================================= */}

      <Card title="Client" step="1">
        {selected ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="text-base font-semibold text-slate-900">{selected.name}</p>
              {selected.company && <p className="text-slate-600">{selected.company}</p>}
              {(selected.email || selected.secondaryEmail) && (
                <p className="mt-1 break-words text-slate-600">
                  {[selected.email, selected.secondaryEmail].filter(Boolean).join(" · ")}
                </p>
              )}
              {selected.phone && <p className="text-slate-600">{selected.phone}</p>}
              <p className="mt-1 text-slate-500">
                {formatAddress({
                  address_line_1: selected.addressLine1,
                  address_line_2: selected.addressLine2,
                  town: selected.town,
                  county: selected.county,
                  postcode: selected.postcode,
                }) || "No address on file"}
              </p>
            </div>

            <button
              type="button"
              onClick={backToSearch}
              className="shrink-0 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Change
            </button>
          </div>
        ) : addingNew ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">New client</p>
              <button
                type="button"
                onClick={backToSearch}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ← Back to search
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <TextField
                  label="Name"
                  name="new_client_name"
                  required
                  value={newClient.name}
                  onChange={(value) => setNewClient({ ...newClient, name: value })}
                />
              </div>
              <TextField
                label="Email"
                name="new_client_email"
                type="email"
                value={newClient.email}
                onChange={(value) => setNewClient({ ...newClient, email: value })}
              />
              <TextField
                label="Secondary email (optional)"
                name="new_client_secondary_email"
                type="email"
                value={newClient.secondaryEmail}
                onChange={(value) => setNewClient({ ...newClient, secondaryEmail: value })}
              />
              <TextField
                label="Phone"
                name="new_client_phone"
                type="tel"
                value={newClient.phone}
                onChange={(value) => setNewClient({ ...newClient, phone: value })}
              />
              <div className="hidden md:block" />
              <TextField
                label="Address line 1"
                name="new_client_address_line_1"
                value={newClient.addressLine1}
                onChange={(value) => setNewClient({ ...newClient, addressLine1: value })}
              />
              <TextField
                label="Address line 2"
                name="new_client_address_line_2"
                value={newClient.addressLine2}
                onChange={(value) => setNewClient({ ...newClient, addressLine2: value })}
              />
              <TextField
                label="Town"
                name="new_client_town"
                value={newClient.town}
                onChange={(value) => setNewClient({ ...newClient, town: value })}
              />
              <TextField
                label="County"
                name="new_client_county"
                value={newClient.county}
                onChange={(value) => setNewClient({ ...newClient, county: value })}
              />
              <TextField
                label="Postcode"
                name="new_client_postcode"
                spellCheck={false}
                value={newClient.postcode}
                onChange={(value) => setNewClient({ ...newClient, postcode: value })}
              />
            </div>

            <p className="mt-3 text-xs text-slate-500">
              The client is saved when you book the survey.
            </p>
          </div>
        ) : (
          <div>
            <input
              ref={searchRef}
              type="search"
              spellCheck={false}
              autoComplete="off"
              aria-label="Search clients"
              placeholder="Search by name, company, email, phone or postcode"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLocalError(null);
              }}
              className={inputClass}
            />

            {query.trim() && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {matches.length === 0 ? (
                  <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      No clients match “{query.trim()}”.
                    </p>
                    <button
                      type="button"
                      onClick={startNewClient}
                      className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 sm:self-auto"
                    >
                      + Add new client
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {matches.map((client) => (
                      <li key={client.id}>
                        <button
                          type="button"
                          onClick={() => chooseClient(client)}
                          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-900">
                            {client.name}
                            {client.company && client.company !== client.name && (
                              <span className="font-normal text-slate-500"> — {client.company}</span>
                            )}
                          </span>
                          <span className="truncate text-sm text-slate-500">
                            {[client.email, client.phone, client.postcode]
                              .filter(Boolean)
                              .join(" · ") || "No contact details"}
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={startNewClient}
                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        + Add new client instead
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* =================================================
          2. SURVEY ADDRESS
          ================================================= */}

      <Card title="Survey address" step="2">
        {!differentAddress && (
          <p className="mb-4 text-sm text-slate-600">
            {activeClient
              ? clientAddress
                ? clientAddress
                : "This client has no address on file. Tick the box below to enter the survey address."
              : "Uses the client's address."}
          </p>
        )}

        <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="different_address"
            checked={differentAddress}
            onChange={(event) => setDifferentAddress(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
          />
          Survey at a different address
        </label>

        {differentAddress && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextField
                label="Address line 1"
                name="site_address_line_1"
                value={site.addressLine1}
                onChange={(value) => setSite({ ...site, addressLine1: value })}
              />
            </div>
            <div className="md:col-span-2">
              <TextField
                label="Address line 2"
                name="site_address_line_2"
                value={site.addressLine2}
                onChange={(value) => setSite({ ...site, addressLine2: value })}
              />
            </div>
            <TextField
              label="Town"
              name="site_town"
              value={site.town}
              onChange={(value) => setSite({ ...site, town: value })}
            />
            <TextField
              label="County"
              name="site_county"
              value={site.county}
              onChange={(value) => setSite({ ...site, county: value })}
            />
            <TextField
              label="Postcode"
              name="site_postcode"
              spellCheck={false}
              value={site.postcode}
              onChange={(value) => setSite({ ...site, postcode: value })}
            />
          </div>
        )}
      </Card>

      {/* =================================================
          3-5. WHEN, FEE, NOTES
          ================================================= */}

      <Card title="Survey details" step="3">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <TextField
              label="Survey date"
              name="survey_date"
              type="date"
              required
              value={surveyDate}
              onChange={setSurveyDate}
            />
          </div>
          <TextField
            label="Start time"
            name="start_time"
            type="time"
            required
            value={startTime}
            onChange={(value) => {
              setStartTime(value);
              if (!endEdited) {
                setEndTime(addMinutesToTime(value, DEFAULT_SURVEY_MINUTES));
              }
            }}
          />
          <TextField
            label="End time"
            name="end_time"
            type="time"
            required
            value={endTime}
            onChange={(value) => {
              setEndTime(value);
              setEndEdited(true);
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The end time is set to one hour after the start. You can change it.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="survey_fee" className="mb-2 block text-sm font-medium text-slate-700">
              Survey fee (£)<span className="text-red-500"> *</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
                £
              </span>
              <input
                id="survey_fee"
                name="survey_fee"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                spellCheck={false}
                placeholder="0.00"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="notes" className="mb-2 block text-sm font-medium text-slate-700">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            spellCheck
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Damp in rear bedroom, access via side gate"
            className={inputClass}
          />
        </div>
      </Card>

      {/* =================================================
          6. EMAIL
          ================================================= */}

      <Card title="Invoice" step="4">
        <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="send_email"
            checked={sendEmail}
            onChange={(event) => setSendEmail(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
          />
          <span>
            Email the invoice to the client now
            <span className="mt-1 block break-words font-normal text-slate-500">
              {!activeClient
                ? "Choose a client first to see where it will be sent."
                : recipients.length === 0
                  ? "This client has no email address, so the invoice will be created but not emailed."
                  : sendEmail
                    ? `Will be sent to ${describeRecipients(recipients)}, with the invoice PDF and the online payment link.`
                    : `Not sending. You can email it later from the invoice (${describeRecipients(recipients)}).`}
            </span>
          </span>
        </label>
        <p className="mt-3 text-xs text-slate-500">
          The invoice is dated today and due on receipt.
        </p>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/jobs"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Booking…" : "Book survey"}
        </button>
      </div>
    </form>
  );
}

function Card({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 md:p-8">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  spellCheck,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  spellCheck?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        spellCheck={spellCheck ?? type === "text"}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}
