import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  const supabase =
    await createClient();

  const [
    clientResult,
    jobsResult,
    quotesResult,
    invoicesResult,
    contractsResult,
    guaranteesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        display_name,
        friendly_name,
        first_name,
        last_name,
        company_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        town,
        county,
        postcode,
        notes,
        created_at
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        job_type,
        status,
        town,
        postcode,
        estimated_value,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        title,
        status,
        amount,
        valid_until,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_type,
        status,
        amount,
        amount_paid,
        due_date,
        paid_at,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        status,
        signed_at,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("guarantees")
      .select(`
        id,
        guarantee_number,
        title,
        guarantee_type,
        status,
        issue_date,
        expiry_date,
        sent_at,
        viewed_at,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const client =
    clientResult.data;

  if (
    clientResult.error ||
    !client
  ) {
    notFound();
  }

  const jobs =
    jobsResult.data ?? [];

  const quotes =
    quotesResult.data ?? [];

  const invoices =
    invoicesResult.data ?? [];

  const contracts =
    contractsResult.data ?? [];

  const guarantees =
    guaranteesResult.data ?? [];

  const clientName =
    client.display_name ||
    [
      client.first_name,
      client.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    client.company_name ||
    "Unnamed client";

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <Link
              href="/clients"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Clients
            </Link>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">
                Client Record
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {clientName}
              </h1>

              {client.friendly_name && (
                <p className="mt-2 text-slate-500">
                  Contact:{" "}
                  {
                    client.friendly_name
                  }
                </p>
              )}
            </div>
          </div>

          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Jobs"
              value={jobs.length}
            />

            <SummaryCard
              title="Quotes"
              value={quotes.length}
            />

            <SummaryCard
              title="Contracts"
              value={
                contracts.length
              }
            />

            <SummaryCard
              title="Invoices"
              value={
                invoices.length
              }
            />

            <SummaryCard
              title="Guarantees"
              value={
                guarantees.length
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Contact Details
              </h2>

              <div className="mt-5 space-y-4">
                <DetailRow
                  label="Email"
                  value={
                    client.email
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    client.phone
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Address
              </h2>

              <div className="mt-5 text-sm text-slate-700">
                {client.address_line_1 ? (
                  <>
                    <p>
                      {
                        client.address_line_1
                      }
                    </p>

                    {client.address_line_2 && (
                      <p>
                        {
                          client.address_line_2
                        }
                      </p>
                    )}

                    {client.town && (
                      <p>
                        {
                          client.town
                        }
                      </p>
                    )}

                    {client.county && (
                      <p>
                        {
                          client.county
                        }
                      </p>
                    )}

                    {client.postcode && (
                      <p className="mt-1 font-medium">
                        {
                          client.postcode
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
                Client Notes
              </h2>

              <div className="mt-5 text-sm text-slate-700">
                {client.notes ? (
                  <p className="whitespace-pre-wrap">
                    {client.notes}
                  </p>
                ) : (
                  <p className="text-slate-400">
                    No notes recorded
                  </p>
                )}
              </div>
            </section>
          </div>

          <RecordSection
            title="Jobs"
            subtitle={`${jobs.length} jobs linked to this client`}
          >
            {jobs.length ===
            0 ? (
              <EmptyState text="No jobs for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>
                        Job
                      </TableHeading>

                      <TableHeading>
                        Type
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Location
                      </TableHeading>

                      <TableHeading right>
                        Value
                      </TableHeading>

                      <TableHeading right>
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {jobs.map(
                      (job) => (
                        <tr
                          key={
                            job.id
                          }
                        >
                          <TableCell>
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {
                                job.job_number
                              }
                            </Link>

                            <p className="mt-1 text-sm text-slate-500">
                              {job.title ||
                                "Untitled job"}
                            </p>
                          </TableCell>

                          <TableCell>
                            {job.job_type ||
                              "—"}
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={
                                job.status
                              }
                            />
                          </TableCell>

                          <TableCell>
                            {job.town ||
                              job.postcode ||
                              "—"}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              job.estimated_value
                            )}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/jobs/${job.id}`}
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

          <RecordSection
            title="Quotes"
            subtitle={`${quotes.length} quotes linked to this client`}
          >
            {quotes.length ===
            0 ? (
              <EmptyState text="No quotes for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>
                        Quote
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Valid Until
                      </TableHeading>

                      <TableHeading right>
                        Amount
                      </TableHeading>

                      <TableHeading right>
                        Action
                      </TableHeading>
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
                              quote.valid_until
                            )}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              quote.amount
                            )}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/quotes/${quote.id}`}
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

          <RecordSection
            title="Contracts"
            subtitle={`${contracts.length} contracts linked to this client`}
          >
            {contracts.length ===
            0 ? (
              <EmptyState text="No contracts for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>
                        Contract
                      </TableHeading>

                      <TableHeading>
                        Title
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Signed
                      </TableHeading>

                      <TableHeading right>
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {contracts.map(
                      (
                        contract
                      ) => (
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

          <RecordSection
            title="Invoices"
            subtitle={`${invoices.length} invoices linked to this client`}
          >
            {invoices.length ===
            0 ? (
              <EmptyState text="No invoices for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>
                        Invoice
                      </TableHeading>

                      <TableHeading>
                        Type
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Due Date
                      </TableHeading>

                      <TableHeading right>
                        Amount
                      </TableHeading>

                      <TableHeading right>
                        Paid
                      </TableHeading>

                      <TableHeading right>
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(
                      (
                        invoice
                      ) => (
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
                                invoice.status
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
                              invoice.amount
                            )}
                          </TableCell>

                          <TableCell right>
                            {formatCurrency(
                              Number(
                                invoice.amount_paid ??
                                  0
                              )
                            )}
                          </TableCell>

                          <TableCell right>
                            <RecordLink
                              href={`/invoices/${invoice.id}`}
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

          <RecordSection
            title="Guarantees"
            subtitle={`${guarantees.length} guarantees linked to this client`}
          >
            {guarantees.length ===
            0 ? (
              <EmptyState text="No guarantees for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>
                        Guarantee
                      </TableHeading>

                      <TableHeading>
                        Type
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Issue Date
                      </TableHeading>

                      <TableHeading>
                        Expiry Date
                      </TableHeading>

                      <TableHeading right>
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {guarantees.map(
                      (
                        guarantee
                      ) => {
                        const expired =
                          guarantee.expiry_date
                            ? new Date(
                                `${guarantee.expiry_date}T23:59:59`
                              ) <
                              new Date()
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
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function RecordSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
      </div>

      {children}
    </section>
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
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
    status === "Issued"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Part Paid" ||
          status === "Expired"
        ? "bg-amber-100 text-amber-800"
        : status === "Sent" ||
            status === "Viewed"
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

function TableHeading({
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

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(value)
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const dateValue =
    value.slice(0, 10);

  const [
    year,
    month,
    day,
  ] = dateValue
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
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