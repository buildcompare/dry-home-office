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

const LOGO_RED = "#be1e2d";

// public/dryhome-logo-light.png is 750x750. The mark sits at x 156–617, y 229–521.
const LOGO_FULL = 168;
const LOGO_SCALE = LOGO_FULL / 750;

const COMPANY_LINES = [
  "Fullbrook Avenue",
  "Spencers Wood",
  "Reading",
  "Berkshire",
  "RG7 1FE",
  "0118 9740 020",
  "Contact@dryhomedampproofing.co.uk",
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

  logoFrame: {
    width: Math.round((617 - 156 + 1) * LOGO_SCALE),
    height: Math.round((521 - 229 + 1) * LOGO_SCALE),
    overflow: "hidden",
  },

  logo: {
    width: LOGO_FULL,
    height: LOGO_FULL,
    marginLeft: Math.round(-156 * LOGO_SCALE),
    marginTop: Math.round(-229 * LOGO_SCALE),
  },

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

  quoteHeader: {
    width: 150,
    alignItems: "flex-end",
  },

  quoteLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
  },

  quoteNumber: {
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
    lineHeight: 1.4,
  },

  boldText: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  titleSection: {
    marginTop: 14,
  },

  quoteTitle: {
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

  itemText: {
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
    borderTopColor: LOGO_RED,
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
    color: LOGO_RED,
  },

  terms: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  termsText: {
    marginTop: 4,
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.45,
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
      author="Dry Home Damp Proofing Solutions Ltd"
      subject="Customer Quotation"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {logoDataUri ? (
              <View style={styles.logoFrame}>
                <Image src={logoDataUri} style={styles.logo} />
              </View>
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

          <View style={styles.quoteHeader}>
            <Text style={styles.quoteLabel}>Quotation</Text>
            <Text style={styles.quoteNumber}>{quoteNumber}</Text>
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

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>Prepared For</Text>
            <Text style={styles.boldText}>{clientName}</Text>
            {clientAddressLines.map((line) => (
              <Text key={line} style={styles.normalText}>
                {line}
              </Text>
            ))}
            {clientEmail && (
              <Text style={styles.normalText}>{clientEmail}</Text>
            )}
            {clientPhone && (
              <Text style={styles.normalText}>{clientPhone}</Text>
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
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.quoteTitle}>{title}</Text>
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}
          {customerMessage && (
            <Text style={styles.messageText}>{customerMessage}</Text>
          )}
        </View>

        {labourItems.length > 0 && (
          <QuoteItemsTable title="Labour" items={labourItems} />
        )}

        {materialItems.length > 0 && (
          <QuoteItemsTable title="Materials" items={materialItems} />
        )}

        <View style={styles.totalsWrapper}>
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

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotal}>Total</Text>
              <Text style={styles.grandTotal}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>
        </View>

        {terms && (
          <View style={styles.terms}>
            <Text style={styles.smallLabel}>Terms</Text>
            <Text style={styles.termsText}>{terms}</Text>
          </View>
        )}

        <View fixed style={styles.footer}>
          <Text>Dry Home Damp Proofing Solutions Ltd</Text>
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
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
