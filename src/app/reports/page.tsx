import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import {
  money,
  formatCurrency,
  invoiceRowTotal,
} from "@/lib/money";
import {
  getLondonDateKey,
  getMonthRange,
  formatShortDate,
  formatMonthLabel,
  dateDifferenceInDays,
} from "@/lib/dates";

export default async function ReportsPage() {
  const supabase = await createClient();

  const today = getLondonDateKey(new Date());
  const { monthStart, nextMonthStart } = getMonthRange(today);

  // Year start
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const nextYearStart = `${Number(year) + 1}-01-01`;

  const [
    monthlyInvoicesResult,
    yearlyInvoicesResult,
    monthlyQuotesResult,
    yearlyQuotesResult,
    overdueResult,
    openQuotesResult,
    activeJobsResult,
  ] = await Promise.all([
    // Monthly invoices
    supabase
      .from("invoices")
      .select("id, status, amount, subtotal, vat_amount, amount_paid, invoice_date")
      .gte("invoice_date", monthStart)
      .lt("invoice_date", nextMonthStart)
      .neq("status", "Cancelled"),

    // Yearly invoices
    supabase
      .from("invoices")
      .select("id, status, amount, subtotal, vat_amount, amount_paid, invoice_date")
      .gte("invoice_date", yearStart)
      .lt("invoice_date", nextYearStart)
      .neq("status", "Cancelled"),

    // Monthly quotes (non-draft)
    supabase
      .from("quotes")
      .select("id, status, amount, quote_date")
      .gte("quote_date", monthStart)
      .lt("quote_date", nextMonthStart)
      .neq("status", "Draft")
      .neq("status", "Cancelled"),

    // Yearly quotes
    supabase
      .from("quotes")
      .select("id, status, amount, quote_date")
      .gte("quote_date", yearStart)
      .lt("quote_date", nextYearStart)
      .neq("status", "Draft")
      .neq("status", "Cancelled"),

    // Overdue invoices
    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_type,
        title,
        status,
        amount,
        subtotal,
        vat_amount,
        amount_paid,
        invoice_date,
        due_date,
        clients (
          display_name,
          first_name,
          last_name
        )
      `)
      .lt("due_date", today)
      .neq("status", "Cancelled")
      .order("due_date", { ascending: true }),

    // Open quotes (Sent / Viewed)
    supabase
      .from("quotes")
      .select("id, quote_number, title, status, amount, quote_date, clients(display_name, first_name, last_name)")
      .in("status", ["Sent", "Viewed"])
      .order("quote_date", { ascending: false })
      .limit(10),

    // Active jobs count
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "In Progress"),
  ]);

  const monthlyInvoices = monthlyInvoicesResult.data ?? [];
  const yearlyInvoices = yearlyInvoicesResult.data ?? [];
  const monthlyQuotes = monthlyQuotesResult.data ?? [];
  const yearlyQuotes = yearlyQuotesResult.data ?? [];
  const openQuotes = openQuotesResult.data ?? [];

  // Monthly calculations
  const invoicedThisMonth = money(
    monthlyInvoices.reduce((t, inv) => t + invoiceRowTotal(inv), 0)
  );
  const paidThisMonth = money(
    monthlyInvoices.reduce((t, inv) => t + Number(inv.amount_paid ?? 0), 0)
  );
  const quotedThisMonth = money(
    monthlyQuotes.reduce((t, q) => t + Number(q.amount ?? 0), 0)
  );
  const acceptedThisMonth = money(
    monthlyQuotes
      .filter((q) => q.status === "Accepted")
      .reduce((t, q) => t + Number(q.amount ?? 0), 0)
  );

  // Yearly calculations
  const invoicedThisYear = money(
    yearlyInvoices.reduce((t, inv) => t + invoiceRowTotal(inv), 0)
  );
  const paidThisYear = money(
    yearlyInvoices.reduce((t, inv) => t + Number(inv.amount_paid ?? 0), 0)
  );
  const quotedThisYear = money(
    yearlyQuotes.reduce((t, q) => t + Number(q.amount ?? 0), 0)
  );
  const acceptedThisYear = money(
    yearlyQuotes
      .filter((q) => q.status === "Accepted")
      .reduce((t, q) => t + Number(q.amount ?? 0), 0)
  );

  // Conversion rates
  const monthQuoteCount = monthlyQuotes.length;
  const monthAcceptedCount = monthlyQuotes.filter((q) => q.status === "Accepted").length;
  const monthConversion =
    monthQuoteCount > 0
      ? Math.round((monthAcceptedCount / monthQuoteCount) * 100)
      : 0;

  const yearQuoteCount = yearlyQuotes.length;
  const yearAcceptedCount = yearlyQuotes.filter((q) => q.status === "Accepted").length;
  const yearConversion =
    yearQuoteCount > 0
      ? Math.round((yearAcceptedCount / yearQuoteCount) * 100)
      : 0;

  // Overdue
  const overdueInvoices = (overdueResult.data ?? [])
    .map((invoice) => {
      const invoiceTotal = invoiceRowTotal(invoice);
      const amountPaid = Number(invoice.amount_paid ?? 0);
      const outstanding = money(Math.max(invoiceTotal - amountPaid, 0));
      return { ...invoice, invoiceTotal, amountPaid, outstanding };
    })
    .filter((inv) => inv.outstanding > 0.009);

  const overdueTotal = money(
    overdueInvoices.reduce((t, inv) => t + inv.outstanding, 0)
  );

  const activeJobCount = activeJobsResult.count ?? 0;
  const monthLabel = formatMonthLabel(monthStart);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="mb-8">
            <p className="text-sm font-medium text-slate-500">
              Dry Home Damp Proofing Solutions
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Reports & Money
            </h1>
            <p className="mt-2 text-slate-500">
              Overview of quoting, invoicing and cash position
            </p>
          </div>

          {/* THIS MONTH */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              This Month — {monthLabel}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <ReportCard
                title="Quoted"
                value={formatCurrency(quotedThisMonth)}
                subtitle={`${monthQuoteCount} quotes`}
                href="/quotes"
              />
              <ReportCard
                title="Accepted"
                value={formatCurrency(acceptedThisMonth)}
                subtitle={`${monthConversion}% conversion`}
                href="/quotes"
                accent="emerald"
              />
              <ReportCard
                title="Invoiced"
                value={formatCurrency(invoicedThisMonth)}
                subtitle="Issued this month"
                href="/invoices"
              />
              <ReportCard
                title="Paid"
                value={formatCurrency(paidThisMonth)}
                subtitle="Received this month"
                href="/invoices"
                accent="emerald"
              />
            </div>
          </section>

          {/* THIS YEAR */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              This Year — {year}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <ReportCard
                title="Quoted"
                value={formatCurrency(quotedThisYear)}
                subtitle={`${yearQuoteCount} quotes`}
                href="/quotes"
              />
              <ReportCard
                title="Accepted"
                value={formatCurrency(acceptedThisYear)}
                subtitle={`${yearConversion}% conversion`}
                href="/quotes"
                accent="emerald"
              />
              <ReportCard
                title="Invoiced"
                value={formatCurrency(invoicedThisYear)}
                subtitle="Issued this year"
                href="/invoices"
              />
              <ReportCard
                title="Paid"
                value={formatCurrency(paidThisYear)}
                subtitle="Received this year"
                href="/invoices"
                accent="emerald"
              />
            </div>
          </section>

          {/* KEY METRICS */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Key Metrics
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <ReportCard
                title="Outstanding (Overdue)"
                value={formatCurrency(overdueTotal)}
                subtitle={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"}`}
                href="/invoices"
                accent={overdueTotal > 0 ? "red" : "emerald"}
              />
              <ReportCard
                title="Active Jobs"
                value={String(activeJobCount)}
                subtitle="Currently in progress"
                href="/jobs?view=active"
              />
              <ReportCard
                title="Open Quotes"
                value={String(openQuotes.length)}
                subtitle="Awaiting customer response"
                href="/quotes"
                accent="amber"
              />
            </div>
          </section>

          {/* OVERDUE TABLE */}
          <section className="mb-10 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Overdue Invoices
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invoices past their due date with an outstanding balance
                </p>
              </div>
              <p className={`text-xl font-bold ${overdueTotal > 0 ? "text-red-700" : "text-emerald-700"}`}>
                {formatCurrency(overdueTotal)}
              </p>
            </div>

            {overdueInvoices.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-semibold text-emerald-700">
                  No overdue invoices
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Everything currently due has been paid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Invoice
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Overdue
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Outstanding
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overdueInvoices.map((invoice) => {
                      const clientData = Array.isArray(invoice.clients)
                        ? invoice.clients[0]
                        : invoice.clients;
                      const clientName =
                        clientData?.display_name ||
                        [clientData?.first_name, clientData?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "Unknown client";
                      const daysOverdue = invoice.due_date
                        ? dateDifferenceInDays(invoice.due_date, today)
                        : 0;

                      return (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="px-6 py-5 text-sm">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {invoice.invoice_number}
                            </Link>
                          </td>
                          <td className="px-6 py-5 text-sm text-slate-600">
                            {clientName}
                          </td>
                          <td className="px-6 py-5 text-sm font-medium text-red-700">
                            {formatShortDate(invoice.due_date)}
                          </td>
                          <td className="px-6 py-5 text-sm">
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              {daysOverdue} {daysOverdue === 1 ? "day" : "days"}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right text-sm font-bold text-red-700">
                            {formatCurrency(invoice.outstanding)}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* OPEN QUOTES */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Open Quotes
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Quotes that have been sent and are awaiting a response
                </p>
              </div>
              <Link
                href="/quotes"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                View all quotes →
              </Link>
            </div>

            {openQuotes.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-medium text-slate-700">No open quotes</p>
                <p className="mt-2 text-sm text-slate-500">
                  All quotes are either drafts, accepted, or closed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quote
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {openQuotes.map((quote) => {
                      const clientData = Array.isArray(quote.clients)
                        ? quote.clients[0]
                        : quote.clients;
                      const clientName =
                        clientData?.display_name ||
                        [clientData?.first_name, clientData?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "Unknown client";

                      return (
                        <tr key={quote.id} className="hover:bg-slate-50">
                          <td className="px-6 py-5 text-sm">
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {quote.quote_number}
                            </Link>
                            {quote.title && (
                              <p className="mt-1 text-xs text-slate-400">
                                {quote.title}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-5 text-sm text-slate-600">
                            {clientName}
                          </td>
                          <td className="px-6 py-5 text-sm text-slate-600">
                            {formatShortDate(quote.quote_date)}
                          </td>
                          <td className="px-6 py-5 text-sm">
                            <StatusBadge status={quote.status} />
                          </td>
                          <td className="px-6 py-5 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(quote.amount)}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                              href={`/quotes/${quote.id}`}
                              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ReportCard({
  title,
  value,
  subtitle,
  href,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  href: string;
  accent?: "emerald" | "red" | "amber";
}) {
  const accentClasses =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : accent === "red"
        ? "border-red-200 bg-red-50"
        : accent === "amber"
          ? "border-amber-200 bg-amber-50"
          : "bg-white";

  const valueClasses =
    accent === "emerald"
      ? "text-emerald-800"
      : accent === "red"
        ? "text-red-800"
        : accent === "amber"
          ? "text-amber-800"
          : "text-slate-900";

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accentClasses}`}
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={`mt-3 text-3xl font-bold ${valueClasses}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
    </Link>
  );
}
