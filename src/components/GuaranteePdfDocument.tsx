import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { PDF_LOGO_STYLE } from "@/lib/pdf-logo-style";

/*
 * Guarantee certificate PDF. Laid out to match the quote, contract
 * and invoice PDFs. Built by src/lib/guarantee-pdf.ts for both the
 * download route and the email attachment. The long standard quote
 * terms are deliberately not appended.
 */

export type GuaranteePdfDocumentProps = {
  logoDataUri?: string | null;

  guaranteeNumber: string;
  title: string;
  guaranteeType: string;
  issueDate: string | null;
  expiryDate: string | null;
  durationYears: number | null;

  clientName: string;
  clientCompanyName: string | null;
  clientEmail: string | null;
  clientSecondaryEmail: string | null;
  clientPhone: string | null;
  clientAddressLines: string[];

  jobNumber: string | null;
  jobTitle: string | null;
  siteAddressLines: string[];

  contractNumber: string | null;
  invoiceNumber: string | null;

  coveredWorks: string | null;
  terms: string | null;
  exclusions: string | null;
  customerMessage: string | null;
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

  textSection: {
    marginTop: 16,
  },

  bodyText: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#334155",
  },

  typeColumn: {
    width: "34%",
    padding: 6,
  },

  periodColumn: {
    width: "18%",
    padding: 6,
  },

  dateColumn: {
    width: "24%",
    padding: 6,
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

export default function GuaranteePdfDocument({
  logoDataUri,
  guaranteeNumber,
  title,
  guaranteeType,
  issueDate,
  expiryDate,
  durationYears,
  clientName,
  clientCompanyName,
  clientEmail,
  clientSecondaryEmail,
  clientPhone,
  clientAddressLines,
  jobNumber,
  jobTitle,
  siteAddressLines,
  contractNumber,
  invoiceNumber,
  coveredWorks,
  terms,
  exclusions,
  customerMessage,
}: GuaranteePdfDocumentProps) {
  const companyLine = clientCompanyName?.trim() || "";
  const customerLines = filledLines([
    ...clientAddressLines,
    clientEmail,
    clientSecondaryEmail,
    clientPhone,
  ]);
  const siteLines = filledLines(siteAddressLines);
  const references = filledLines([
    contractNumber ? `Contract ${contractNumber}` : null,
    invoiceNumber ? `Invoice ${invoiceNumber}` : null,
  ]);
  const period =
    durationYears && durationYears > 0
      ? `${formatNumber(durationYears)} ${durationYears === 1 ? "year" : "years"}`
      : "—";

  return (
    <Document
      title={`${guaranteeNumber} - ${title}`}
      author="Dry Home Damp Proofing Solutions Ltd"
      subject="Guarantee"
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
            <Text style={styles.docLabel}>Guarantee</Text>
            <Text style={styles.docNumber}>{guaranteeNumber}</Text>
            {issueDate && (
              <Text style={styles.dateText}>
                Issued: {formatDate(issueDate)}
              </Text>
            )}
            {expiryDate && (
              <Text style={styles.dateText}>
                Expires: {formatDate(expiryDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>Issued To</Text>
            <Text style={styles.boldText}>{clientName}</Text>
            {companyLine && (
              <Text style={styles.addressText}>{companyLine}</Text>
            )}
            {customerLines.length > 0 && (
              <Text style={styles.addressText}>
                {customerLines.join("\n")}
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
            {references.length > 0 && (
              <Text style={styles.referenceText}>
                {references.join("\n")}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.docTitle}>{title}</Text>
          {customerMessage && (
            <Text style={styles.messageText}>{customerMessage}</Text>
          )}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Guarantee details</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.typeColumn}>
                <Text style={styles.tableHeadingText}>Guarantee</Text>
              </View>
              <View style={styles.periodColumn}>
                <Text style={styles.tableHeadingText}>Period</Text>
              </View>
              <View style={styles.dateColumn}>
                <Text style={styles.tableHeadingText}>Start date</Text>
              </View>
              <View style={styles.dateColumn}>
                <Text style={styles.tableHeadingText}>Expiry date</Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={styles.typeColumn}>
                <Text style={[styles.itemText, styles.boldText]}>
                  {guaranteeType}
                </Text>
              </View>
              <View style={styles.periodColumn}>
                <Text style={styles.itemText}>{period}</Text>
              </View>
              <View style={styles.dateColumn}>
                <Text style={styles.itemText}>
                  {issueDate ? formatDate(issueDate) : "—"}
                </Text>
              </View>
              <View style={styles.dateColumn}>
                <Text style={styles.itemText}>
                  {expiryDate ? formatDate(expiryDate) : "—"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TextSection title="Covered works" text={coveredWorks} />
        <TextSection title="Guarantee terms" text={terms} />
        <TextSection title="Exclusions" text={exclusions} />

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

function TextSection({
  title,
  text,
}: {
  title: string;
  text: string | null;
}) {
  if (!text?.trim()) {
    return null;
  }

  return (
    <View style={styles.textSection}>
      <Text style={styles.sectionTitle} minPresenceAhead={30}>
        {title}
      </Text>
      <Text style={styles.bodyText}>{text.trim()}</Text>
    </View>
  );
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
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
