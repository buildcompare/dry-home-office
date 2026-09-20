import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { updateEmailTemplate } from "./actions";

type EmailTemplatesPageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

type EmailTemplate = {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

const templateOrder = [
  "quote",
  "contract",
  "invoice",
  "guarantee",
];

export default async function EmailTemplatesPage({
  searchParams,
}: EmailTemplatesPageProps) {
  const query =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "email_templates"
    )
    .select(`
      id,
      template_key,
      name,
      subject,
      body,
      created_at,
      updated_at
    `);

  if (error) {
    console.error(
      "Unable to load email templates:",
      error
    );
  }

  const templates =
    (
      (data ?? []) as EmailTemplate[]
    ).sort(
      (a, b) =>
        templateOrder.indexOf(
          a.template_key
        ) -
        templateOrder.indexOf(
          b.template_key
        )
    );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">

          {/* HEADER */}

          <div className="mb-8">
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to Dashboard
            </Link>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">
                Settings
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Email Templates
              </h1>

              <p className="mt-2 max-w-3xl text-slate-500">
                Edit the standard wording used when sending quotes, contracts, invoices and guarantees.
              </p>
            </div>
          </div>

          {/* SUCCESS */}

          {query.saved && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
              Email template saved successfully.
            </div>
          )}

          {/* ERROR */}

          {query.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {/* INFO */}

          <section className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Dynamic Placeholders
            </p>

            <h2 className="mt-2 text-lg font-bold text-blue-950">
              Personalise emails automatically
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-800">
              Text inside double curly brackets will eventually be replaced with information from the client, job or document when the email is sent.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Placeholder>
                {"{{client_name}}"}
              </Placeholder>

              <Placeholder>
                {"{{job_title}}"}
              </Placeholder>

              <Placeholder>
                {"{{view_link}}"}
              </Placeholder>
            </div>

            <p className="mt-4 text-xs text-blue-700">
              Each template below shows the additional placeholders available for that email type.
            </p>
          </section>

          {/* TEMPLATES */}

          {templates.length ===
          0 ? (
            <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                No email templates found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                The email_templates table is empty or could not be loaded.
              </p>
            </section>
          ) : (
            <div className="space-y-8">
              {templates.map(
                (template) => (
                  <TemplateCard
                    key={
                      template.id
                    }
                    template={
                      template
                    }
                  />
                )
              )}
            </div>
          )}

          {/* FOOTER NOTE */}

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current Stage
            </p>

            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              Templates are editable, but not connected to sending yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Saving changes here will update the template stored in DryHome Office. Our next step will be connecting the Quote email sender to the Quote Email template.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   TEMPLATE CARD
   ========================================================= */

function TemplateCard({
  template,
}: {
  template: EmailTemplate;
}) {
  const description =
    getTemplateDescription(
      template.template_key
    );

  const placeholders =
    getTemplatePlaceholders(
      template.template_key
    );

  return (
    <section
      id={
        template.template_key
      }
      className="overflow-hidden rounded-2xl bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {
                formatTemplateKey(
                  template.template_key
                )
              }
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {
                template.name
              }
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {
                description
              }
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Email Template
          </span>
        </div>
      </div>

      <form
        action={
          updateEmailTemplate
        }
        className="p-6"
      >
        <input
          type="hidden"
          name="template_key"
          value={
            template.template_key
          }
        />

        {/* PLACEHOLDERS */}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Available Placeholders
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {placeholders.map(
              (
                placeholder
              ) => (
                <Placeholder
                  key={
                    placeholder
                  }
                >
                  {
                    placeholder
                  }
                </Placeholder>
              )
            )}
          </div>
        </div>

        {/* SUBJECT */}

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-slate-700">
            Email Subject
          </span>

          <input
            type="text"
            name="subject"
            required
            defaultValue={
              template.subject
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-500"
          />
        </label>

        {/* BODY */}

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-slate-700">
            Email Message
          </span>

          <textarea
            name="body"
            required
            rows={16}
            defaultValue={
              template.body
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none focus:border-slate-500"
          />
        </label>

        {/* SAVE */}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-400">
            Last updated{" "}
            {formatDateTime(
              template.updated_at
            )}
          </p>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Save Template
          </button>
        </div>
      </form>
    </section>
  );
}

/* =========================================================
   PLACEHOLDER
   ========================================================= */

function Placeholder({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <code className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
      {children}
    </code>
  );
}

/* =========================================================
   TEMPLATE DETAILS
   ========================================================= */

function getTemplateDescription(
  key: string
) {
  switch (key) {
    case "quote":
      return "Used when sending a quotation to a customer for review and acceptance.";

    case "contract":
      return "Used when sending a contract or agreement relating to an accepted job.";

    case "invoice":
      return "Used when sending an invoice or payment request to a customer.";

    case "guarantee":
      return "Used when sending the completed works guarantee to the customer.";

    default:
      return "Standard customer email template.";
  }
}

function getTemplatePlaceholders(
  key: string
) {
  const common = [
    "{{client_name}}",
    "{{job_title}}",
    "{{view_link}}",
  ];

  switch (key) {
    case "quote":
      return [
        ...common,
        "{{quote_number}}",
        "{{quote_total}}",
      ];

    case "contract":
      return [
        ...common,
        "{{contract_number}}",
      ];

    case "invoice":
      return [
        ...common,
        "{{invoice_number}}",
        "{{invoice_total}}",
        "{{amount_outstanding}}",
      ];

    case "guarantee":
      return [
        ...common,
        "{{guarantee_number}}",
      ];

    default:
      return common;
  }
}

/* =========================================================
   TEMPLATE KEY
   ========================================================= */

function formatTemplateKey(
  value: string
) {
  if (!value) {
    return "Template";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

/* =========================================================
   DATE
   ========================================================= */

function formatDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}