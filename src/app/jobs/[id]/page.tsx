import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { updateJobStatus } from "@/app/jobs/actions";

type JobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobPage({
  params,
}: JobPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  /* =========================================================
     JOB
     ========================================================= */

  const { data: job, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      client_id,
      title,
      job_type,
      status,
      address_line_1,
      address_line_2,
      town,
      county,
      postcode,
      survey_date,
      start_date,
      completion_date,
      description,
      notes,
      estimated_value,
      created_at,

      clients (
        id,
        display_name,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq("id", id)
    .single();

  if (error || !job) {
    notFound();
  }

  const clientData = Array.isArray(job.clients)
    ? job.clients[0]
    : job.clients;

  const clientName =
    clientData?.display_name ||
    [clientData?.first_name, clientData?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Unknown client";

  /* =========================================================
     RELATED RECORDS
     ========================================================= */

  const [
    scheduleResult,
    quotesResult,
    contractsResult,
    invoicesResult,
    guaranteesResult,
  ] = await Promise.all([
    supabase
      .from("schedule_events")
      .select(`
        id,
        title,
        event_type,
        status,
        start_date,
        end_date,
        start_time,
        end_time,
        all_day,
        location,
        assigned_to,
        contract_id
      `)
      .eq("job_id", id)
      .order("start_date", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
      }),

    supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        status,
        amount,
        quote_date,
        created_at
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("contracts")
      .select(`
        id,
        quote_id,
        contract_number,
        title,
        status,
        amount,
        contract_date,
        signed_at,
        created_at
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("invoices")
      .select(`
        id,
        quote_id,
        contract_id,
        invoice_number,
        invoice_type,
        status,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        invoice_date,
        due_date,
        paid_at,
        created_at
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("guarantees")
      .select(`
        id,
        invoice_id,
        guarantee_number,
        title,
        guarantee_type,
        status,
        issue_date,
        expiry_date,
        created_at
      `)
      .eq("job_id", id)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const scheduleEvents =
    scheduleResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const contracts =
    contractsResult.data ?? [];

  const invoices =
    invoicesResult.data ?? [];

  const guarantees =
    guaranteesResult.data ?? [];

  /* =========================================================
     PIPELINE
     ========================================================= */

  const pipeline =
    getJobPipeline(job.status);

  /* =========================================================
     ACCEPTED QUOTE
     ========================================================= */

  const acceptedQuote =
    quotes.find(
      (quote) =>
        quote.status === "Accepted"
    ) ?? null;

  const latestQuote =
    quotes.length > 0
      ? quotes[0]
      : null;

  const acceptedQuoteValue =
    acceptedQuote
      ? money(
          Number(
            acceptedQuote.amount ?? 0
          )
        )
      : 0;

  /* =========================================================
     CONTRACT
     ========================================================= */

  const linkedContract =
    acceptedQuote
      ? contracts.find(
          (contract) =>
            contract.quote_id ===
              acceptedQuote.id &&
            contract.status !==
              "Cancelled"
        ) ?? null
      : null;

  /* =========================================================
     QUOTE INVOICES
     ========================================================= */

  const quoteInvoices =
    acceptedQuote
      ? invoices.filter(
          (invoice) =>
            invoice.quote_id ===
              acceptedQuote.id &&
            invoice.status !==
              "Cancelled"
        )
      : [];

  const invoicedTotal = money(
    quoteInvoices.reduce(
      (total, invoice) =>
        total +
        invoiceRowTotal(invoice),
      0
    )
  );

  const paidTotal = money(
    quoteInvoices.reduce(
      (total, invoice) =>
        total +
        Number(
          invoice.amount_paid ?? 0
        ),
      0
    )
  );

  const remainingToInvoice =
    money(
      Math.max(
        acceptedQuoteValue -
          invoicedTotal,
        0
      )
    );

  const outstanding =
    money(
      quoteInvoices.reduce(
        (total, invoice) => {
          const invoiceTotal =
            invoiceRowTotal(invoice);

          const paid =
            Number(
              invoice.amount_paid ?? 0
            );

          return (
            total +
            Math.max(
              invoiceTotal - paid,
              0
            )
          );
        },
        0
      )
    );

  const fullyInvoiced =
    acceptedQuoteValue > 0 &&
    remainingToInvoice <= 0.009;

  const everyInvoicePaid =
    quoteInvoices.length > 0 &&
    quoteInvoices.every(
      (invoice) => {
        const invoiceTotal =
          invoiceRowTotal(invoice);

        const paid =
          Number(
            invoice.amount_paid ?? 0
          );

        return (
          invoiceTotal > 0 &&
          paid >=
            invoiceTotal - 0.009
        );
      }
    );

  const financiallyComplete =
    fullyInvoiced &&
    everyInvoicePaid;

  /* =========================================================
     GUARANTEE
     ========================================================= */

  const quoteInvoiceIds =
    new Set(
      quoteInvoices.map(
        (invoice) =>
          invoice.id
      )
    );

  const linkedGuarantee =
    guarantees.find(
      (guarantee) =>
        guarantee.status !==
          "Cancelled" &&
        !!guarantee.invoice_id &&
        quoteInvoiceIds.has(
          guarantee.invoice_id
        )
    ) ?? null;

  const guaranteeSourceInvoice =
    financiallyComplete &&
    quoteInvoices.length > 0
      ? quoteInvoices[0]
      : null;

  /* =========================================================
     SCHEDULE
     ========================================================= */

  const today =
    getLondonDateKey(
      new Date()
    );

  const nextAppointment =
    scheduleEvents.find(
      (event) =>
        event.status !==
          "Cancelled" &&
        event.start_date >=
          today
    ) ?? null;

  const workAppointments =
    scheduleEvents.filter(
      (event) =>
        event.status !==
          "Cancelled" &&
        String(
          event.event_type ?? ""
        ).toLowerCase() === "work"
    );

  const hasWorkScheduled =
    workAppointments.length > 0;

  /* =========================================================
     HUB URLS
     ========================================================= */

  const scheduleWorkHref =
    linkedContract
      ? `/schedule/new?job=${job.id}&contract=${linkedContract.id}&type=Work`
      : `/schedule/new?job=${job.id}&type=Work`;

  const createInvoiceHref =
    acceptedQuote
      ? linkedContract?.status ===
        "Signed"
        ? `/invoices/new?contract=${linkedContract.id}`
        : `/invoices/new?quote=${acceptedQuote.id}`
      : "/invoices/new";

  /* =========================================================
     NEXT ACTION
     ========================================================= */

  let nextActionTitle =
    "Create a Quote";

  let nextActionDescription =
    "No quotation has been created for this job yet.";

  let nextActionHref =
    `/quotes/new?job=${job.id}`;

  let nextActionLabel =
    "Create Quote";

  if (
    latestQuote &&
    !acceptedQuote
  ) {
    nextActionTitle =
      "Awaiting Quote Acceptance";

    nextActionDescription =
      `${latestQuote.quote_number} is currently ${latestQuote.status}. Open the quote to review or record customer approval.`;

    nextActionHref =
      `/quotes/${latestQuote.id}`;

    nextActionLabel =
      "View Quote";
  }

  if (acceptedQuote) {
    if (!hasWorkScheduled) {
      nextActionTitle =
        "Schedule the Work";

      nextActionDescription =
        "The quotation has been accepted. The next practical step is to book the work into the schedule.";

      nextActionHref =
        scheduleWorkHref;

      nextActionLabel =
        "Schedule Work";
    } else if (
      !fullyInvoiced
    ) {
      nextActionTitle =
        "Invoice the Job";

      nextActionDescription =
        `${formatCurrency(
          remainingToInvoice
        )} remains available to invoice against the accepted quotation.`;

      nextActionHref =
        createInvoiceHref;

      nextActionLabel =
        quoteInvoices.length > 0
          ? "Create Another Invoice"
          : "Create Invoice";
    } else if (
      !everyInvoicePaid
    ) {
      nextActionTitle =
        "Awaiting Payment";

      nextActionDescription =
        `${formatCurrency(
          outstanding
        )} remains outstanding across the invoices for this job.`;

      nextActionHref =
        quoteInvoices.length > 0
          ? `/invoices/${quoteInvoices[0].id}`
          : `/quotes/${acceptedQuote.id}`;

      nextActionLabel =
        "View Invoices";
    } else if (
      linkedGuarantee
    ) {
      nextActionTitle =
        "Job Financially Complete";

      nextActionDescription =
        "The accepted quotation has been fully invoiced and paid, and the guarantee has been created.";

      nextActionHref =
        `/guarantees/${linkedGuarantee.id}`;

      nextActionLabel =
        "View Guarantee";
    } else if (
      guaranteeSourceInvoice
    ) {
      nextActionTitle =
        "Generate the Guarantee";

      nextActionDescription =
        "The job is fully invoiced and all invoice balances have been paid.";

      nextActionHref =
        `/guarantees/new?invoice=${guaranteeSourceInvoice.id}`;

      nextActionLabel =
        "Generate Guarantee";
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-8">
            <Link
              href="/jobs"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Jobs
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-slate-500">
                    {job.job_number}
                  </p>

                  <PipelineBadge
                    pipeline={
                      pipeline
                    }
                  />

                  <StatusBadge
                    status={
                      job.status
                    }
                  />
                </div>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {job.title ||
                    "Untitled Job"}
                </h1>

                <p className="mt-2 text-slate-500">
                  {clientName}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {!acceptedQuote && (
                  <>
                    <Link
                      href={`/schedule/new?job=${job.id}&type=Survey`}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Schedule Survey
                    </Link>

                    <Link
                      href={`/quotes/new?job=${job.id}`}
                      className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                      + Create Quote
                    </Link>
                  </>
                )}

                {acceptedQuote && (
                  <Link
                    href={`/quotes/${acceptedQuote.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Accepted Quote
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* JOB STATUS */}

          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Job Status
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Move Job Through Workflow
                  </h2>

                  <PipelineBadge
                    pipeline={
                      pipeline
                    }
                  />
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Upcoming jobs stay in Upcoming until work actually starts.
                  In Progress moves the job into Active, and Completed moves
                  it into Completed.
                </p>
              </div>

              <form
                action={
                  updateJobStatus
                }
                className="flex flex-wrap items-center gap-3"
              >
                <input
                  type="hidden"
                  name="job_id"
                  value={
                    job.id
                  }
                />

                <select
                  name="status"
                  defaultValue={
                    job.status ===
                    "Complete"
                      ? "Completed"
                      : job.status
                  }
                  className="min-w-[190px] rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-500"
                >
                  <option value="Enquiry">
                    Enquiry
                  </option>

                  <option value="Survey Booked">
                    Survey Booked
                  </option>

                  <option value="Quoted">
                    Quoted
                  </option>

                  <option value="Accepted">
                    Accepted
                  </option>

                  <option value="Scheduled">
                    Scheduled
                  </option>

                  <option value="In Progress">
                    In Progress
                  </option>

                  <option value="Completed">
                    Completed
                  </option>

                  <option value="Cancelled">
                    Cancelled
                  </option>
                </select>

                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Update Status
                </button>
              </form>
            </div>
          </section>

          {/* NEXT ACTION */}

          <section
            className={`rounded-2xl border p-6 ${
              financiallyComplete
                ? "border-emerald-200 bg-emerald-50"
                : acceptedQuote
                  ? "border-blue-200 bg-blue-50"
                  : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-3xl">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    financiallyComplete
                      ? "text-emerald-700"
                      : acceptedQuote
                        ? "text-blue-700"
                        : "text-amber-700"
                  }`}
                >
                  Next Action
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {nextActionTitle}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {
                    nextActionDescription
                  }
                </p>
              </div>

              <Link
                href={
                  nextActionHref
                }
                className={`rounded-lg px-5 py-3 text-sm font-semibold text-white ${
                  financiallyComplete
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : acceptedQuote
                      ? "bg-blue-700 hover:bg-blue-800"
                      : "bg-amber-700 hover:bg-amber-800"
                }`}
              >
                {
                  nextActionLabel
                }
              </Link>
            </div>
          </section>

          {/* JOB HUB */}

          {acceptedQuote ? (
            <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Job Hub
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {
                        acceptedQuote.quote_number
                      }{" "}
                      — Accepted
                    </h2>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Manage the live job from here. Schedule the work,
                      create an optional contract, raise partial or full
                      invoices, track payments and generate the guarantee
                      when the job is financially complete.
                    </p>
                  </div>

                  <StatusBadge
                    status="Accepted"
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={
                      scheduleWorkHref
                    }
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Schedule Work
                  </Link>

                  {linkedContract ? (
                    <Link
                      href={`/contracts/${linkedContract.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View Contract
                    </Link>
                  ) : (
                    <Link
                      href={`/contracts/new?quote=${acceptedQuote.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Create Contract
                    </Link>
                  )}

                  {!fullyInvoiced ? (
                    <Link
                      href={
                        createInvoiceHref
                      }
                      className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      {quoteInvoices.length >
                      0
                        ? "Create Another Invoice"
                        : "Create Invoice"}
                    </Link>
                  ) : (
                    <span className="rounded-lg bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
                      Fully Invoiced
                    </span>
                  )}

                  {linkedGuarantee ? (
                    <Link
                      href={`/guarantees/${linkedGuarantee.id}`}
                      className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      View Guarantee
                    </Link>
                  ) : guaranteeSourceInvoice ? (
                    <Link
                      href={`/guarantees/new?invoice=${guaranteeSourceInvoice.id}`}
                      className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Generate Guarantee
                    </Link>
                  ) : null}

                  <Link
                    href={`/quotes/${acceptedQuote.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Quote
                  </Link>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 md:grid-cols-5">
                <WorkflowStat
                  title="Accepted Value"
                  value={formatCurrency(
                    acceptedQuoteValue
                  )}
                />

                <WorkflowStat
                  title="Invoiced"
                  value={formatCurrency(
                    invoicedTotal
                  )}
                />

                <WorkflowStat
                  title="Paid"
                  value={formatCurrency(
                    paidTotal
                  )}
                />

                <WorkflowStat
                  title="Outstanding"
                  value={formatCurrency(
                    outstanding
                  )}
                />

                <WorkflowStat
                  title="Remaining to Invoice"
                  value={formatCurrency(
                    remainingToInvoice
                  )}
                  strong={
                    remainingToInvoice >
                    0.009
                  }
                />
              </div>

              <div className="border-t border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Workflow
                </h3>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <WorkflowStep
                    title="Quote"
                    value="Accepted"
                    complete
                  />

                  <WorkflowStep
                    title="Contract"
                    value={
                      linkedContract
                        ? linkedContract.status
                        : "Optional"
                    }
                    complete={
                      linkedContract?.status ===
                      "Signed"
                    }
                  />

                  <WorkflowStep
                    title="Work"
                    value={
                      hasWorkScheduled
                        ? "Scheduled"
                        : "Not Scheduled"
                    }
                    complete={
                      hasWorkScheduled
                    }
                  />

                  <WorkflowStep
                    title="Invoicing"
                    value={
                      fullyInvoiced
                        ? "Complete"
                        : `${formatCurrency(
                            remainingToInvoice
                          )} remaining`
                    }
                    complete={
                      fullyInvoiced
                    }
                  />

                  <WorkflowStep
                    title="Guarantee"
                    value={
                      linkedGuarantee
                        ? linkedGuarantee.status
                        : financiallyComplete
                          ? "Available"
                          : "Not Ready"
                    }
                    complete={
                      !!linkedGuarantee
                    }
                  />
                </div>
              </div>

              {financiallyComplete &&
                !linkedGuarantee &&
                guaranteeSourceInvoice && (
                  <div className="border-t border-emerald-200 bg-emerald-50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Financially Complete
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-emerald-950">
                          Guarantee Available
                        </h3>

                        <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-800">
                          The accepted quote has been fully invoiced and every linked invoice has been paid in full.
                        </p>
                      </div>

                      <Link
                        href={`/guarantees/new?invoice=${guaranteeSourceInvoice.id}`}
                        className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        Generate Guarantee
                      </Link>
                    </div>
                  </div>
                )}

              <div className="border-t border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Contract
                    </p>

                    {linkedContract ? (
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {
                          linkedContract.contract_number
                        }{" "}
                        ·{" "}
                        {
                          linkedContract.status
                        }
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">
                        No contract created. Contracts are optional.
                      </p>
                    )}
                  </div>

                  {linkedContract ? (
                    <Link
                      href={`/contracts/${linkedContract.id}`}
                      className="text-sm font-semibold text-slate-700 hover:underline"
                    >
                      View Contract →
                    </Link>
                  ) : (
                    <Link
                      href={`/contracts/new?quote=${acceptedQuote.id}`}
                      className="text-sm font-semibold text-slate-700 hover:underline"
                    >
                      Create Contract →
                    </Link>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Job Hub
              </p>

              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Waiting for an Accepted Quote
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Once a quote is accepted, this area becomes the live Job Hub with scheduling, contract, invoicing, payment and guarantee controls.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {latestQuote ? (
                  <Link
                    href={`/quotes/${latestQuote.id}`}
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    View Latest Quote
                  </Link>
                ) : (
                  <Link
                    href={`/quotes/new?job=${job.id}`}
                    className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Create Quote
                  </Link>
                )}

                <Link
                  href={`/schedule/new?job=${job.id}&type=Survey`}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Schedule Survey
                </Link>
              </div>
            </section>
          )}

          {/* NEXT APPOINTMENT */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Schedule
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Next Appointment
                </h2>
              </div>

              <Link
                href="/schedule"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                Open Schedule →
              </Link>
            </div>

            {nextAppointment ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-5 rounded-xl bg-slate-50 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {
                        nextAppointment.title
                      }
                    </p>

                    <StatusBadge
                      status={
                        nextAppointment.event_type
                      }
                    />

                    <StatusBadge
                      status={
                        nextAppointment.status
                      }
                    />
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    {formatDate(
                      nextAppointment.start_date
                    )}
                  </p>

                  {nextAppointment.location && (
                    <p className="mt-1 text-sm text-slate-400">
                      {
                        nextAppointment.location
                      }
                    </p>
                  )}
                </div>

                <p className="text-xl font-bold text-slate-900">
                  {nextAppointment.all_day
                    ? "All day"
                    : formatEventTime(
                        nextAppointment.start_time,
                        nextAppointment.end_time
                      )}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No future appointments are currently booked for this job.
              </div>
            )}
          </section>

          {/* SUMMARY */}

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Job Status"
              value={
                job.status
              }
            />

            <SummaryCard
              title="Pipeline"
              value={
                pipeline
              }
            />

            <SummaryCard
              title="Job Type"
              value={
                job.job_type ||
                "Not set"
              }
            />

            <SummaryCard
              title="Appointments"
              value={String(
                scheduleEvents.length
              )}
            />

            <SummaryCard
              title="Accepted Value"
              value={
                acceptedQuote
                  ? formatCurrency(
                      acceptedQuoteValue
                    )
                  : job.estimated_value !==
                      null
                    ? formatCurrency(
                        job.estimated_value
                      )
                    : "Not set"
              }
            />
          </div>

          {/* CLIENT / ADDRESS / DATES */}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Client
                </h2>

                {clientData?.id && (
                  <Link
                    href={`/clients/${clientData.id}`}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    View Client →
                  </Link>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Name"
                  value={
                    clientName
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    clientData?.phone
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    clientData?.email
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Job Address
              </h2>

              <div className="mt-5 text-sm leading-6 text-slate-700">
                {job.address_line_1 ? (
                  <>
                    <p>
                      {
                        job.address_line_1
                      }
                    </p>

                    {job.address_line_2 && (
                      <p>
                        {
                          job.address_line_2
                        }
                      </p>
                    )}

                    {job.town && (
                      <p>
                        {
                          job.town
                        }
                      </p>
                    )}

                    {job.county && (
                      <p>
                        {
                          job.county
                        }
                      </p>
                    )}

                    {job.postcode && (
                      <p className="mt-1 font-semibold">
                        {
                          job.postcode
                        }
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400">
                    No address recorded
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Dates
              </h2>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Survey Date"
                  value={formatDate(
                    job.survey_date
                  )}
                />

                <DetailRow
                  label="Start Date"
                  value={formatDate(
                    job.start_date
                  )}
                />

                <DetailRow
                  label="Completion Date"
                  value={formatDate(
                    job.completion_date
                  )}
                />
              </div>
            </section>
          </div>

          {/* DESCRIPTION / NOTES */}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Description
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {job.description ||
                  "No description recorded."}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Internal Notes
              </h2>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {job.notes ||
                  "No notes recorded."}
              </p>
            </section>
          </div>

          {/* SCHEDULE */}

          <RecordSection
            title="Schedule"
            subtitle={`${scheduleEvents.length} appointments linked to this job`}
            action={
              <div className="flex flex-wrap gap-2">
                {!acceptedQuote && (
                  <Link
                    href={`/schedule/new?job=${job.id}&type=Survey`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Schedule Survey
                  </Link>
                )}

                {acceptedQuote && (
                  <Link
                    href={
                      scheduleWorkHref
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Schedule Work
                  </Link>
                )}

                <Link
                  href="/schedule"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  View Schedule
                </Link>
              </div>
            }
          >
            {scheduleEvents.length === 0 ? (
              <EmptyState text="No appointments scheduled for this job yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {scheduleEvents.map(
                  (event) => (
                    <div
                      key={
                        event.id
                      }
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {
                              event.title
                            }
                          </p>

                          <StatusBadge
                            status={
                              event.event_type
                            }
                          />

                          <StatusBadge
                            status={
                              event.status
                            }
                          />
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {formatDate(
                            event.start_date
                          )}

                          {event.end_date &&
                            event.end_date !==
                              event.start_date &&
                            ` – ${formatDate(
                              event.end_date
                            )}`}
                        </p>

                        {event.location && (
                          <p className="mt-1 text-sm text-slate-500">
                            {
                              event.location
                            }
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">
                          {event.all_day
                            ? "All day"
                            : formatEventTime(
                                event.start_time,
                                event.end_time
                              )}
                        </p>

                        {event.assigned_to && (
                          <p className="mt-1 text-xs text-slate-500">
                            {
                              event.assigned_to
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </RecordSection>

          {/* QUOTES */}

          <RecordSection
            title="Quotes"
            subtitle={`${quotes.length} quotes linked to this job`}
            action={
              <Link
                href={`/quotes/new?job=${job.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                + Create Quote
              </Link>
            }
          >
            {quotes.length === 0 ? (
              <EmptyState text="No quotes created for this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Quote
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Date
                      </Heading>

                      <Heading right>
                        Amount
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {quotes.map(
                      (quote) => (
                        <tr
                          key={
                            quote.id
                          }
                        >
                          <TableCell>
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {
                                quote.quote_number
                              }
                            </Link>

                            <p className="mt-1 text-sm text-slate-500">
                              {quote.title ||
                                "Quote"}
                            </p>
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={
                                quote.status
                              }
                            />
                          </TableCell>

                          <TableCell>
                            {formatDate(
                              quote.quote_date
                            )}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              quote.amount
                            )}
                          </TableCell>

                          <TableCell right>
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              View Quote
                            </Link>
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* CONTRACTS */}

          <RecordSection
            title="Contracts"
            subtitle={`${contracts.length} contracts linked to this job`}
            action={
              acceptedQuote &&
              !linkedContract ? (
                <Link
                  href={`/contracts/new?quote=${acceptedQuote.id}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Create Contract
                </Link>
              ) : undefined
            }
          >
            {contracts.length === 0 ? (
              <EmptyState text="No contracts linked to this job. Contracts are optional." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Contract
                      </Heading>

                      <Heading>
                        Title
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Signed
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {contracts.map(
                      (contract) => (
                        <tr
                          key={
                            contract.id
                          }
                        >
                          <TableCell>
                            <Link
                              href={`/contracts/${contract.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {
                                contract.contract_number
                              }
                            </Link>
                          </TableCell>

                          <TableCell>
                            {contract.title ||
                              "Contract"}
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={
                                contract.status
                              }
                            />
                          </TableCell>

                          <TableCell>
                            {contract.signed_at
                              ? formatDate(
                                  contract.signed_at
                                )
                              : "—"}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/contracts/${contract.id}`}
                            />
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* INVOICES */}

          <RecordSection
            title="Invoices"
            subtitle={`${invoices.length} invoices linked to this job`}
            action={
              acceptedQuote &&
              !fullyInvoiced ? (
                <Link
                  href={
                    createInvoiceHref
                  }
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  + Create Invoice
                </Link>
              ) : undefined
            }
          >
            {invoices.length === 0 ? (
              <EmptyState text="No invoices linked to this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Invoice
                      </Heading>

                      <Heading>
                        Type
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Due Date
                      </Heading>

                      <Heading right>
                        Amount
                      </Heading>

                      <Heading right>
                        Paid
                      </Heading>

                      <Heading right>
                        Outstanding
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(
                      (invoice) => {
                        const invoiceAmount =
                          invoiceRowTotal(
                            invoice
                          );

                        const paid =
                          Number(
                            invoice.amount_paid ??
                              0
                          );

                        const invoiceOutstanding =
                          money(
                            Math.max(
                              invoiceAmount -
                                paid,
                              0
                            )
                          );

                        const derivedStatus =
                          invoice.status ===
                          "Cancelled"
                            ? "Cancelled"
                            : invoiceAmount >
                                  0 &&
                                paid >=
                                  invoiceAmount -
                                    0.009
                              ? "Paid"
                              : paid > 0
                                ? "Part Paid"
                                : invoice.status;

                        return (
                          <tr
                            key={
                              invoice.id
                            }
                          >
                            <TableCell>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  invoice.invoice_number
                                }
                              </Link>
                            </TableCell>

                            <TableCell>
                              {invoice.invoice_type ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  derivedStatus
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.due_date
                              )}
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                invoiceAmount
                              )}
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                paid
                              )}
                            </TableCell>

                            <TableCell right>
                              {formatCurrency(
                                invoiceOutstanding
                              )}
                            </TableCell>

                            <TableCell right>
                              <RecordLink
                                href={`/invoices/${invoice.id}`}
                              />
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          {/* GUARANTEES */}

          <RecordSection
            title="Guarantees"
            subtitle={`${guarantees.length} guarantees linked to this job`}
            action={
              !linkedGuarantee &&
              guaranteeSourceInvoice ? (
                <Link
                  href={`/guarantees/new?invoice=${guaranteeSourceInvoice.id}`}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  + Generate Guarantee
                </Link>
              ) : undefined
            }
          >
            {guarantees.length === 0 ? (
              <EmptyState text="No guarantees linked to this job yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Heading>
                        Guarantee
                      </Heading>

                      <Heading>
                        Type
                      </Heading>

                      <Heading>
                        Status
                      </Heading>

                      <Heading>
                        Issue Date
                      </Heading>

                      <Heading>
                        Expiry Date
                      </Heading>

                      <Heading right>
                        Action
                      </Heading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {guarantees.map(
                      (guarantee) => {
                        const expired =
                          guarantee.expiry_date
                            ? guarantee.expiry_date <
                              today
                            : false;

                        const displayStatus =
                          guarantee.status ===
                          "Cancelled"
                            ? "Cancelled"
                            : expired
                              ? "Expired"
                              : guarantee.status;

                        return (
                          <tr
                            key={
                              guarantee.id
                            }
                          >
                            <TableCell>
                              <Link
                                href={`/guarantees/${guarantee.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {
                                  guarantee.guarantee_number
                                }
                              </Link>

                              <p className="mt-1 text-sm text-slate-500">
                                {guarantee.title ||
                                  "Works Guarantee"}
                              </p>
                            </TableCell>

                            <TableCell>
                              {guarantee.guarantee_type ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  displayStatus
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                guarantee.issue_date
                              )}
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                guarantee.expiry_date
                              )}
                            </TableCell>

                            <TableCell right>
                              <RecordLink
                                href={`/guarantees/${guarantee.id}`}
                              />
                            </TableCell>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function WorkflowStat({
  title,
  value,
  strong = false,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "bg-slate-900 p-6"
          : "bg-white p-6"
      }
    >
      <p
        className={
          strong
            ? "text-xs font-semibold uppercase tracking-wide text-slate-300"
            : "text-xs font-semibold uppercase tracking-wide text-slate-400"
        }
      >
        {title}
      </p>

      <p
        className={
          strong
            ? "mt-2 text-xl font-bold text-white"
            : "mt-2 text-xl font-bold text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}

function WorkflowStep({
  title,
  value,
  complete = false,
}: {
  title: string;
  value: string;
  complete?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        complete
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          complete
            ? "text-emerald-700"
            : "text-slate-400"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-2 text-sm font-bold ${
          complete
            ? "text-emerald-900"
            : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PipelineBadge({
  pipeline,
}: {
  pipeline: string;
}) {
  const classes =
    pipeline === "Active"
      ? "bg-blue-100 text-blue-800"
      : pipeline === "Completed"
        ? "bg-emerald-100 text-emerald-800"
        : pipeline === "Archived"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-800";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {pipeline}
    </span>
  );
}

function RecordSection({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {value ||
          "Not recorded"}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Paid" ||
    status === "Signed" ||
    status === "Accepted" ||
    status === "Issued" ||
    status === "Completed" ||
    status === "Complete"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Part Paid" ||
          status === "Expired"
        ? "bg-amber-100 text-amber-800"
        : status === "Sent" ||
            status === "Viewed" ||
            status === "Scheduled" ||
            status === "Survey" ||
            status === "Survey Booked" ||
            status === "Work" ||
            status === "In Progress"
          ? "bg-blue-100 text-blue-800"
          : status === "Cancelled" ||
              status === "Declined" ||
              status === "Overdue"
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}

function Heading({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td
      className={`px-6 py-5 text-sm text-slate-600 ${
        right
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </td>
  );
}

function RecordLink({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
    >
      View
    </Link>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm text-slate-500">
        {text}
      </p>
    </div>
  );
}

function getJobPipeline(
  status: string
) {
  if (
    status === "Complete" ||
    status === "Completed"
  ) {
    return "Completed";
  }

  if (
    status === "Cancelled"
  ) {
    return "Archived";
  }

  if (
    status === "In Progress"
  ) {
    return "Active";
  }

  return "Upcoming";
}

function invoiceRowTotal(invoice: {
  amount?: number | string | null;
  subtotal?: number | string | null;
  vat_amount?: number | string | null;
}) {
  const amount =
    Number(
      invoice.amount ?? 0
    );

  if (
    Number.isFinite(amount) &&
    amount > 0
  ) {
    return money(amount);
  }

  const subtotal =
    Number(
      invoice.subtotal ?? 0
    );

  const vatAmount =
    Number(
      invoice.vat_amount ?? 0
    );

  return money(
    (Number.isFinite(subtotal)
      ? subtotal
      : 0) +
      (Number.isFinite(vatAmount)
        ? vatAmount
        : 0)
  );
}

function money(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    money(
      Number(
        value ?? 0
      )
    )
  );
}

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )
  );
}

function formatEventTime(
  start: string | null,
  end: string | null
) {
  if (!start) {
    return "Time not set";
  }

  const startTime =
    start.slice(0, 5);

  if (!end) {
    return startTime;
  }

  return `${startTime} – ${end.slice(
    0,
    5
  )}`;
}

function getLondonDateKey(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  return `${year}-${month}-${day}`;
}