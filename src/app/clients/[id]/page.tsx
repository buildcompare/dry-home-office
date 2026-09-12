import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    clientResult,
    jobsResult,
    quotesResult,
    invoicesResult,
    contractsResult,
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
      .order("created_at", { ascending: false }),

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
      .order("created_at", { ascending: false }),

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        status,
        amount,
        due_date,
        paid_at,
        created_at
      `)
      .eq("client_id", id)
      .order("created_at", { ascending: false }),

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
      .order("created_at", { ascending: false }),
  ]);

  const client = clientResult.data;

  if (clientResult.error || !client) {
    notFound();
  }

  const jobs = jobsResult.data ?? [];
  const quotes = quotesResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const contracts = contractsResult.data ?? [];

  const clientName =
    client.display_name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
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
                  Contact: {client.friendly_name}
                </p>
              )}
            </div>
          </div>

          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Jobs"
              value={jobs.length}
            />

            <SummaryCard
              title="Quotes"
              value={quotes.length}
            />

            <SummaryCard
              title="Invoices"
              value={invoices.length}
            />

            <SummaryCard
              title="Contracts"
              value={contracts.length}
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
                  value={client.email}
                />

                <DetailRow
                  label="Phone"
                  value={client.phone}
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
                    <p>{client.address_line_1}</p>

                    {client.address_line_2 && (
                      <p>{client.address_line_2}</p>
                    )}

                    {client.town && <p>{client.town}</p>}
                    {client.county && <p>{client.county}</p>}

                    {client.postcode && (
                      <p className="mt-1 font-medium">
                        {client.postcode}
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
            {jobs.length === 0 ? (
              <EmptyState text="No jobs for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>Job</TableHeading>
                      <TableHeading>Type</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Location</TableHeading>
                      <TableHeading right>Value</TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {job.job_number}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {job.title || "Untitled job"}
                          </p>
                        </TableCell>

                        <TableCell>
                          {job.job_type || "—"}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>

                        <TableCell>
                          {job.town || job.postcode || "—"}
                        </TableCell>

                        <TableCell right>
                          {formatCurrency(job.estimated_value)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          <RecordSection
            title="Quotes"
            subtitle={`${quotes.length} quotes linked to this client`}
          >
            {quotes.length === 0 ? (
              <EmptyState text="No quotes for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>Quote</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Valid Until</TableHeading>
                      <TableHeading right>Amount</TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {quotes.map((quote) => (
                      <tr key={quote.id}>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {quote.quote_number}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {quote.title || "Quote"}
                          </p>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={quote.status} />
                        </TableCell>

                        <TableCell>
                          {formatDate(quote.valid_until)}
                        </TableCell>

                        <TableCell right>
                          {formatCurrency(quote.amount)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          <RecordSection
            title="Invoices"
            subtitle={`${invoices.length} invoices linked to this client`}
          >
            {invoices.length === 0 ? (
              <EmptyState text="No invoices for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>Invoice</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Due Date</TableHeading>
                      <TableHeading right>Amount</TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {invoice.invoice_number}
                          </p>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={invoice.status} />
                        </TableCell>

                        <TableCell>
                          {formatDate(invoice.due_date)}
                        </TableCell>

                        <TableCell right>
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </RecordSection>

          <RecordSection
            title="Contracts"
            subtitle={`${contracts.length} contracts linked to this client`}
          >
            {contracts.length === 0 ? (
              <EmptyState text="No contracts for this client yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeading>Contract</TableHeading>
                      <TableHeading>Title</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Signed</TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {contracts.map((contract) => (
                      <tr key={contract.id}>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {contract.contract_number}
                          </p>
                        </TableCell>

                        <TableCell>
                          {contract.title || "Contract"}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={contract.status} />
                        </TableCell>

                        <TableCell>
                          {contract.signed_at
                            ? formatDate(contract.signed_at)
                            : "—"}
                        </TableCell>
                      </tr>
                    ))}
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

function EmptyState({ text }: { text: string }) {
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
        {value || "Not recorded"}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      {status}
    </span>
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
        right ? "text-right" : "text-left"
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
        right ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}