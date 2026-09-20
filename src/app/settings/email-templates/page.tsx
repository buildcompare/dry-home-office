import Sidebar from "@/components/Sidebar";

import { createClient } from "@/lib/supabase/server";

import {
  updateEmailTemplate,
} from "./actions";

type EmailTemplatesPageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
  }>;
};

type EmailTemplate = {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string | null;
};

const templateOrder = [
  "quote",
  "contract",
  "invoice",
  "variation",
  "guarantee",
];

const placeholderMap: Record<
  string,
  string[]
> = {
  quote: [
    "{{client_name}}",
    "{{quote_number}}",
    "{{job_title}}",
    "{{quote_total}}",
    "{{view_link}}",
  ],

  contract: [
    "{{client_name}}",
    "{{contract_number}}",
    "{{job_title}}",
    "{{view_link}}",
  ],

  invoice: [
    "{{client_name}}",
    "{{invoice_number}}",
    "{{job_title}}",
    "{{invoice_total}}",
    "{{amount_outstanding}}",
    "{{view_link}}",
  ],

  variation: [
    "{{client_name}}",
    "{{variation_number}}",
    "{{job_title}}",
    "{{variation_total}}",
    "{{view_link}}",
  ],

  guarantee: [
    "{{client_name}}",
    "{{guarantee_number}}",
    "{{job_title}}",
    "{{view_link}}",
  ],
};

const descriptions: Record<
  string,
  string
> = {
  quote:
    "Used when sending quotations to customers.",

  contract:
    "Used when sending contracts to customers for review and signing.",

  invoice:
    "Used when sending invoices and payment information.",

  variation:
    "Used when sending additional works or variations to the customer for approval.",

  guarantee:
    "Used when sending completed works guarantees to customers.",
};

export default async function EmailTemplatesPage({
  searchParams,
}: EmailTemplatesPageProps) {
  const params =
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
      updated_at
    `);

  if (error) {
    console.error(
      "Email templates load error:",
      error
    );
  }

  const templates =
    (
      data ??
      []
    ) as EmailTemplate[];

  const sortedTemplates =
    [...templates].sort(
      (a, b) => {
        const aIndex =
          templateOrder.indexOf(
            a.template_key
          );

        const bIndex =
          templateOrder.indexOf(
            b.template_key
          );

        if (
          aIndex === -1 &&
          bIndex === -1
        ) {
          return a.name.localeCompare(
            b.name
          );
        }

        if (
          aIndex === -1
        ) {
          return 1;
        }

        if (
          bIndex === -1
        ) {
          return -1;
        }

        return (
          aIndex -
          bIndex
        );
      }
    );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">

          {/* HEADER */}

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Settings
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Email Templates
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Control the default subject and
              message used when sending
              documents from DryHome Office.
              You can still edit each email
              individually before sending it.
            </p>
          </div>

          {/* SUCCESS */}

          {params.updated && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-sm font-semibold text-emerald-800">
                Email template saved
                successfully.
              </p>
            </div>
          )}

          {/* ERROR */}

          {params.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">
                {decodeURIComponent(
                  params.error
                )}
              </p>
            </div>
          )}

          {/* INFO */}

          <section className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Master Templates
            </p>

            <h2 className="mt-2 text-lg font-bold text-blue-950">
              These are your starting
              templates
            </h2>

            <p className="mt-2 text-sm leading-6 text-blue-800">
              When you click Send Email on
              a quote, contract, invoice,
              variation or guarantee, the
              relevant template is loaded
              automatically. Changes made
              while sending one email do not
              alter these master templates.
            </p>
          </section>

          {/* TEMPLATES */}

          <div className="space-y-8">
            {sortedTemplates.length ===
            0 ? (
              <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  No email templates were
                  found.
                </p>
              </section>
            ) : (
              sortedTemplates.map(
                (
                  template
                ) => {
                  const placeholders =
                    placeholderMap[
                      template
                        .template_key
                    ] ?? [];

                  const isVariation =
                    template.template_key ===
                    "variation";

                  return (
                    <section
                      key={
                        template.id
                      }
                      className={`overflow-hidden rounded-2xl bg-white shadow-sm ${
                        isVariation
                          ? "ring-1 ring-amber-200"
                          : ""
                      }`}
                    >
                      <div
                        className={`border-b p-6 ${
                          isVariation
                            ? "border-amber-200 bg-amber-50"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                isVariation
                                  ? "text-amber-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {
                                template.template_key
                              }
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-slate-900">
                              {
                                template.name
                              }
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                              {
                                descriptions[
                                  template
                                    .template_key
                                ] ||
                                "Default email template."
                              }
                            </p>
                          </div>

                          {isVariation && (
                            <span
                              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                              style={{
                                backgroundColor:
                                  "#d97706",
                              }}
                            >
                              New
                            </span>
                          )}
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
                            Available
                            Placeholders
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {placeholders.map(
                              (
                                placeholder
                              ) => (
                                <code
                                  key={
                                    placeholder
                                  }
                                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  {
                                    placeholder
                                  }
                                </code>
                              )
                            )}
                          </div>

                          <p className="mt-3 text-xs leading-5 text-slate-400">
                            These placeholders
                            are replaced
                            automatically with
                            the customer's
                            actual information
                            when the email is
                            prepared.
                          </p>
                        </div>

                        {/* SUBJECT */}

                        <div className="mt-6">
                          <label
                            htmlFor={`subject-${template.id}`}
                            className="mb-2 block text-sm font-semibold text-slate-700"
                          >
                            Email Subject
                          </label>

                          <input
                            id={`subject-${template.id}`}
                            type="text"
                            name="subject"
                            required
                            defaultValue={
                              template.subject
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                          />
                        </div>

                        {/* BODY */}

                        <div className="mt-6">
                          <label
                            htmlFor={`body-${template.id}`}
                            className="mb-2 block text-sm font-semibold text-slate-700"
                          >
                            Email Message
                          </label>

                          <textarea
                            id={`body-${template.id}`}
                            name="body"
                            required
                            rows={15}
                            defaultValue={
                              template.body
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-slate-500"
                          />
                        </div>

                        {/* VIEW LINK NOTE */}

                        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-800">
                            Secure document
                            link
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            The secure customer
                            button/link is added
                            automatically when
                            the email is sent.
                            It does not need to
                            appear in the
                            editable message.
                          </p>
                        </div>

                        {/* SAVE */}

                        <div className="mt-6 flex justify-end">
                          <button
                            type="submit"
                            className="rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                            style={{
                              backgroundColor:
                                isVariation
                                  ? "#d97706"
                                  : "#0f172a",
                            }}
                          >
                            Save{" "}
                            {
                              template.name
                            }{" "}
                            Template
                          </button>
                        </div>
                      </form>
                    </section>
                  );
                }
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}