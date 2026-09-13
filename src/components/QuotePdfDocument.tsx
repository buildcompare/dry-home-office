import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
};

type QuotePdfDocumentProps = {
  logoDataUri?: string | null;

  quoteNumber: string;
  title: string;
  description: string | null;
  quoteDate: string;
  validUntil: string | null;

  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddressLines: string[];

  jobNumber: string | null;
  jobTitle: string | null;

  labourItems: QuoteItem[];
  materialItems: QuoteItem[];

  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;

  customerMessage: string | null;
  terms: string | null;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 48,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#334155",
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },

  branding: {
    width: "55%",
  },

  logo: {
    width: 125,
    maxHeight: 55,
    objectFit: "contain",
    marginBottom: 8,
  },

  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  companyWebsite: {
    marginTop: 4,
    color: "#64748b",
  },

  quoteHeader: {
    width: "40%",
    alignItems: "flex-end",
  },

  quoteLabel: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
  },

  quoteNumber: {
    marginTop: 4,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  dateText: {
    marginTop: 4,
    color: "#64748b",
  },

  section: {
    marginTop: 24,
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
    marginBottom: 4,
  },

  normalText: {
    lineHeight: 1.5,
  },

  boldText: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  titleSection: {
    marginTop: 26,
    padding: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
  },

  quoteTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  description: {
    marginTop: 12,
    fontSize: 10,
    lineHeight: 1.55,
    color: "#475569",
  },

  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 10,
  },

  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  descriptionColumn: {
    width: "46%",
    padding: 8,
  },

  qtyColumn: {
    width: "10%",
    padding: 8,
    textAlign: "right",
  },

  unitColumn: {
    width: "12%",
    padding: 8,
  },

  priceColumn: {
    width: "16%",
    padding: 8,
    textAlign: "right",
  },

  totalColumn: {
    width: "16%",
    padding: 8,
    textAlign: "right",
  },

  tableHeadingText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },

  itemText: {
    lineHeight: 1.35,
  },

  totalsWrapper: {
    marginTop: 24,
    alignItems: "flex-end",
  },

  totalsBox: {
    width: 245,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 2,
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
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  messageBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 5,
  },

  messageText: {
    marginTop: 7,
    lineHeight: 1.5,
  },

  terms: {
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  termsText: {
    marginTop: 7,
    fontSize: 8.5,
    color: "#64748b",
    lineHeight: 1.5,
  },

  footer: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

export default function QuotePdfDocument({
  logoDataUri,
  quoteNumber,
  title,
  description,
  quoteDate,
  validUntil,
  clientName,
  clientEmail,
  clientPhone,
  clientAddressLines,
  jobNumber,
  jobTitle,
  labourItems,
  materialItems,
  subtotal,
  vatEnabled,
  vatRate,
  vatAmount,
  total,
  customerMessage,
  terms,
}: QuotePdfDocumentProps) {
  return (
    <Document
      title={`${quoteNumber} - ${title}`}
      author="Dry Home Damp Proofing Solutions LTD"
      subject="Customer Quotation"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.branding}>
            {logoDataUri ? (
              <Image
                src={logoDataUri}
                style={styles.logo}
              />
            ) : (
              <Text style={styles.companyName}>
                Dry Home Damp Proofing Solutions LTD
              </Text>
            )}

            <Text style={styles.companyWebsite}>
              dryhomedampproofing.co.uk
            </Text>
          </View>

          <View style={styles.quoteHeader}>
            <Text style={styles.quoteLabel}>
              Quotation
            </Text>

            <Text style={styles.quoteNumber}>
              {quoteNumber}
            </Text>

            <Text style={styles.dateText}>
              Date: {formatDate(quoteDate)}
            </Text>

            {validUntil && (
              <Text style={styles.dateText}>
                Valid until: {formatDate(validUntil)}
              </Text>
            )}
          </View>
        </View>

        {/* Customer / Job */}
        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>
              Prepared For
            </Text>

            <Text style={styles.boldText}>
              {clientName}
            </Text>

            {clientAddressLines.map((line) => (
              <Text
                key={line}
                style={styles.normalText}
              >
                {line}
              </Text>
            ))}

            {clientEmail && (
              <Text style={styles.normalText}>
                {clientEmail}
              </Text>
            )}

            {clientPhone && (
              <Text style={styles.normalText}>
                {clientPhone}
              </Text>
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.smallLabel}>
              Job
            </Text>

            {jobNumber ? (
              <>
                <Text style={styles.boldText}>
                  {jobNumber}
                </Text>

                {jobTitle && (
                  <Text style={styles.normalText}>
                    {jobTitle}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.normalText}>
                No linked job
              </Text>
            )}
          </View>
        </View>

        {/* Quote title / description */}
        <View style={styles.titleSection}>
          <Text style={styles.smallLabel}>
            Title
          </Text>

          <Text style={styles.quoteTitle}>
            {title}
          </Text>

          {description && (
            <>
              <Text
                style={[
                  styles.smallLabel,
                  { marginTop: 16 },
                ]}
              >
                Description / Scope of Works
              </Text>

              <Text style={styles.description}>
                {description}
              </Text>
            </>
          )}
        </View>

        {/* Labour */}
        {labourItems.length > 0 && (
          <QuoteItemsTable
            title="Labour"
            items={labourItems}
          />
        )}

        {/* Materials */}
        {materialItems.length > 0 && (
          <QuoteItemsTable
            title="Materials"
            items={materialItems}
          />
        )}

        {/* Totals */}
        <View style={styles.totalsWrapper}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Subtotal
              </Text>

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

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotal}>
                Total
              </Text>

              <Text style={styles.grandTotal}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer message */}
        {customerMessage && (
          <View style={styles.messageBox}>
            <Text style={styles.smallLabel}>
              Message
            </Text>

            <Text style={styles.messageText}>
              {customerMessage}
            </Text>
          </View>
        )}

        {/* Terms */}
        {terms && (
          <View style={styles.terms}>
            <Text style={styles.smallLabel}>
              Terms
            </Text>

            <Text style={styles.termsText}>
              {terms}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View fixed style={styles.footer}>
          <Text>
            Dry Home Damp Proofing Solutions LTD
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

function QuoteItemsTable({
  title,
  items,
}: {
  title: string;
  items: QuoteItem[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.descriptionColumn}>
            <Text style={styles.tableHeadingText}>
              Item
            </Text>
          </View>

          <View style={styles.qtyColumn}>
            <Text style={styles.tableHeadingText}>
              Qty
            </Text>
          </View>

          <View style={styles.unitColumn}>
            <Text style={styles.tableHeadingText}>
              Unit
            </Text>
          </View>

          <View style={styles.priceColumn}>
            <Text style={styles.tableHeadingText}>
              Price
            </Text>
          </View>

          <View style={styles.totalColumn}>
            <Text style={styles.tableHeadingText}>
              Total
            </Text>
          </View>
        </View>

        {items.map((item) => {
          const lineTotal =
            item.quantity * item.unit_price;

          return (
            <View
              key={item.id}
              style={styles.tableRow}
              wrap={false}
            >
              <View style={styles.descriptionColumn}>
                <Text style={styles.itemText}>
                  {item.description}
                </Text>
              </View>

              <View style={styles.qtyColumn}>
                <Text>
                  {formatNumber(item.quantity)}
                </Text>
              </View>

              <View style={styles.unitColumn}>
                <Text>{item.unit || "—"}</Text>
              </View>

              <View style={styles.priceColumn}>
                <Text>
                  {formatCurrency(item.unit_price)}
                </Text>
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
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}