import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { InvoicePaymentDetails } from "@/lib/company-payment-details";
import { PDF_LOGO_STYLE } from "@/lib/pdf-logo-style";

/*
 * Invoice PDF. Laid out to match the quote and contract PDFs
 * (QuotePdfDocument / ContractPdfDocument). Built by
 * src/lib/invoice-pdf.ts for both the download route and the
 * email attachment.
 */

export type InvoicePdfItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
};

export type InvoicePdfDocumentProps = {
  logoDataUri?: string | null;

  invoiceNumber: string;
  title: string;
  description: string | null;
  invoiceDate: string | null;
  dueDate: string | null;

  clientName: string;
  clientCompanyName: string | null;
  clientEmail: string | null;
  clientSecondaryEmail: string | null;
  clientPhone: string | null;
  clientAddressLines: string[];

  jobNumber: string | null;
  jobTitle: string | null;
  siteAddressLines: string[];

  quoteNumber: string | null;
  contractNumber: string | null;

  labourItems: InvoicePdfItem[];
  materialItems: InvoicePdfItem[];

  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;

  customerMessage: string | null;
  paymentTerms: string | null;
  paymentDetails: InvoicePaymentDetails | null;
};

const LOGO_RED = "#be1e2d";

const COMPANY_LINES = [
  "Fullbrook Avenue",
  "Spencers Wood",
  "Reading",
  "Berkshire",
  "RG7 1FE",
  "0118 9740 020",
  "Contact@dryhomedampproofing.co.uk",
  "Company number 16804053",
];

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 42,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#334155",
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: LOGO_RED,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  logo: PDF_LOGO_STYLE,

  companyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  companyDetail: {
    fontSize: 8,
    lineHeight: 1.35,
    color: "#475569",
  },

  docHeader: {
    width: 150,
    alignItems: "flex-end",
  },

  docLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
  },

  docNumber: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  dateText: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#64748b",
  },

  section: {
    marginTop: 14,
  },

  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },

  column: {
    width: "48%",
  },

  smallLabel: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 3,
  },

  normalText: {
    fontSize: 9.5,
    lineHeight: 1.25,
  },

  addressText: {
    fontSize: 9.5,
    lineHeight: 1.2,
    color: "#334155",
  },

  siteLabel: {
    marginTop: 8,
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },

  referenceText: {
    marginTop: 6,
    fontSize: 9.5,
    lineHeight: 1.25,
  },

  boldText: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  titleSection: {
    marginTop: 14,
  },

  docTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  description: {
    marginTop: 4,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#475569",
  },

  messageText: {
    marginTop: 8,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#334155",
  },

  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
  },

  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: LOGO_RED,
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  descriptionColumn: {
    width: "46%",
    padding: 6,
  },

  qtyColumn: {
    width: "10%",
    padding: 6,
    textAlign: "right",
  },

  unitColumn: {
    width: "12%",
    padding: 6,
  },

  priceColumn: {
    width: "16%",
    padding: 6,
    textAlign: "right",
  },

  totalColumn: {
    width: "16%",
    padding: 6,
    textAlign: "right",
  },

  tableHeadingText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },

  /* fontSize set explicitly so lineHeight is relative to 9.5pt. */
  itemText: {
    fontSize: 9.5,
    lineHeight: 1.35,
  },

  totalsWrapper: {
    marginTop: 12,
    alignItems: "flex-end",
  },

  totalsBox: {
    width: 230,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#0f172a",
  },

  totalLabel: {
    color: "#475569",
  },

  totalValue: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  grandTotal: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  paymentSection: {
    marginTop: 18,
  },

  paymentRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },

  paymentLabel: {
    width: 110,
    color: "#64748b",
  },

  paymentValue: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  paymentHeading: {
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  noteText: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#334155",
  },

  paymentText: {
    marginTop: 6,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#334155",
  },

  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

function filledLines(
  values: Array<string | null | undefined>
) {
  return values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export default function InvoicePdfDocument({
  logoDataUri,
  invoiceNumber,
  title,
  description,
  invoiceDate,
  dueDate,
  clientName,
  clientCompanyName,
  clientEmail,
  clientSecondaryEmail,
  clientPhone,
  clientAddressLines,
  jobNumber,
  jobTitle,
  siteAddressLines,
  quoteNumber,
  contractNumber,
  labourItems,
  materialItems,
  subtotal,
  vatEnabled,
  vatRate,
  vatAmount,
  total,
  amountPaid,
  balanceDue,
  customerMessage,
  paymentTerms,
  paymentDetails,
}: InvoicePdfDocumentProps) {
  const companyLine = clientCompanyName?.trim() || "";
  const billToLines = filledLines([
    ...clientAddressLines,
    clientEmail,
    clientSecondaryEmail,
    clientPhone,
  ]);
  const siteLines = filledLines(siteAddressLines);
  const hasPayments = amountPaid > 0;

  return (
    <Document
      title={`${invoiceNumber} - ${title}`}
      author="Dry Home Damp Proofing Solutions Ltd"
      subject="Invoice"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {logoDataUri ? (
              <Image src={logoDataUri} style={styles.logo} />
            ) : null}

            <View>
              <Text style={styles.companyName}>
                Dry Home Damp Proofing Solutions Ltd
              </Text>
              {COMPANY_LINES.map((line) => (
                <Text key={line} style={styles.companyDetail}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.docHeader}>
            <Text style={styles.docLabel}>Invoice</Text>
            <Text style={styles.docNumber}>{invoiceNumber}</Text>
            {invoiceDate && (
              <Text style={styles.dateText}>
                Date: {formatDate(invoiceDate)}
              </Text>
            )}
            {dueDate && (
              <Text style={styles.dateText}>
                Due: {formatDate(dueDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>Bill To</Text>
            <Text style={styles.boldText}>{clientName}</Text>
            {companyLine && (
              <Text style={styles.addressText}>{companyLine}</Text>
            )}
            {billToLines.length > 0 && (
              <Text style={styles.addressText}>
                {billToLines.join("\n")}
              </Text>
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.smallLabel}>Job</Text>
            {jobNumber ? (
              <>
                <Text style={styles.boldText}>{jobNumber}</Text>
                {jobTitle && (
                  <Text style={styles.normalText}>{jobTitle}</Text>
                )}
              </>
            ) : (
              <Text style={styles.normalText}>No linked job</Text>
            )}
            {siteLines.length > 0 && (
              <>
                <Text style={styles.siteLabel}>Site</Text>
                <Text style={styles.addressText}>
                  {siteLines.join("\n")}
                </Text>
              </>
            )}
            {(quoteNumber || contractNumber) && (
              <Text style={styles.referenceText}>
                {filledLines([
                  quoteNumber ? `Quotation ${quoteNumber}` : null,
                  contractNumber ? `Contract ${contractNumber}` : null,
                ]).join("\n")}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.docTitle}>{title}</Text>
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}
          {customerMessage && (
            <Text style={styles.messageText}>{customerMessage}</Text>
          )}
        </View>

        {labourItems.length > 0 && (
          <InvoiceItemsTable title="Labour" items={labourItems} />
        )}

        {materialItems.length > 0 && (
          <InvoiceItemsTable title="Materials" items={materialItems} />
        )}

        <View style={styles.totalsWrapper} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(subtotal)}
              </Text>
            </View>

            {vatEnabled && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  VAT ({formatNumber(vatRate)}%)
                </Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(vatAmount)}
                </Text>
              </View>
            )}

            {hasPayments ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Invoice total</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(total)}
                  </Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Amount paid</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(amountPaid)}
                  </Text>
                </View>

                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotal}>Balance due</Text>
                  <Text style={styles.grandTotal}>
                    {formatCurrency(balanceDue)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotal}>Total due</Text>
                <Text style={styles.grandTotal}>
                  {formatCurrency(total)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {paymentDetails && (
          <View style={styles.paymentSection} wrap={false}>
            <Text style={styles.sectionTitle}>Payment details</Text>

            {paymentDetails.heading && (
              <Text style={styles.paymentHeading}>
                {paymentDetails.heading}
              </Text>
            )}

            {paymentDetails.rows.map((row) => (
              <View key={row.label} style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>{row.label}:</Text>
                <Text style={styles.paymentValue}>{row.value}</Text>
              </View>
            ))}

            {paymentDetails.referenceNote && (
              <Text style={styles.paymentText}>
                {paymentDetails.referenceNote}
              </Text>
            )}
          </View>
        )}

        {paymentTerms && (
          <View style={styles.paymentSection} wrap={false}>
            <Text style={styles.sectionTitle}>Payment terms</Text>
            <Text style={styles.noteText}>{paymentTerms}</Text>
          </View>
        )}

        <View fixed style={styles.footer}>
          <Text>
            Dry Home Damp Proofing Solutions Ltd · dryhomedampproofing.co.uk
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function InvoiceItemsTable({
  title,
  items,
}: {
  title: string;
  items: InvoicePdfItem[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.descriptionColumn}>
            <Text style={styles.tableHeadingText}>Item</Text>
          </View>
          <View style={styles.qtyColumn}>
            <Text style={styles.tableHeadingText}>Qty</Text>
          </View>
          <View style={styles.unitColumn}>
            <Text style={styles.tableHeadingText}>Unit</Text>
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.tableHeadingText}>Price</Text>
          </View>
          <View style={styles.totalColumn}>
            <Text style={styles.tableHeadingText}>Total</Text>
          </View>
        </View>

        {items.map((item) => {
          const lineTotal = item.quantity * item.unit_price;

          return (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.itemText}>{item.description}</Text>
              </View>
              <View style={styles.qtyColumn}>
                <Text>{formatNumber(item.quantity)}</Text>
              </View>
              <View style={styles.unitColumn}>
                <Text>{item.unit || "—"}</Text>
              </View>
              <View style={styles.priceColumn}>
                <Text>{formatCurrency(item.unit_price)}</Text>
              </View>
              <View style={styles.totalColumn}>
                <Text style={styles.boldText}>
                  {formatCurrency(lineTotal)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
