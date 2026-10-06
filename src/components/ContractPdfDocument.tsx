import type { ReactNode } from "react";

import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { contractSpecialTerms } from "@/lib/contract-special-terms";
import { PDF_LOGO_STYLE } from "@/lib/pdf-logo-style";
import { QUOTE_STANDARD_TERMS } from "@/lib/quote-standard-terms";

type ContractPdfDocumentProps = {
  logoDataUri?: string | null;

  contractNumber: string;
  title: string;
  status: string;
  contractDate: string | null;

  clientName: string;
  clientCompanyName?: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddressLines: string[];

  jobNumber: string | null;
  jobTitle: string | null;
  jobType: string | null;
  propertyAddressLines: string[];

  quoteNumber: string | null;

  description: string | null;
  terms: string | null;
  customerMessage: string | null;

  total: number;

  signedAt: string | null;
  signedName: string | null;
  signedEmail: string | null;

  customerUrl: string;
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
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#334155",
    backgroundColor: "#ffffff",
  },

  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 7,
    padding: 24,
  },

  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  branding: {
    width: "56%",
  },

  logo: {
    width: 140,
    maxHeight: 58,
    objectFit: "contain",
  },

  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#ffffff",
  },

  companyWebsite: {
    marginTop: 7,
    fontSize: 8.5,
    color: "#cbd5e1",
  },

  heroRight: {
    width: "40%",
    alignItems: "flex-end",
  },

  documentLabel: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  contractNumber: {
    marginTop: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#ffffff",
  },

  contractDate: {
    marginTop: 5,
    fontSize: 8.5,
    color: "#cbd5e1",
  },

  titleArea: {
    marginTop: 22,
  },

  eyebrow: {
    fontSize: 8,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  contractTitle: {
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 21,
    color: "#ffffff",
    lineHeight: 1.2,
  },

  statusBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 4,
    backgroundColor: "#1e293b",
  },

  statusText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#e2e8f0",
    textTransform: "uppercase",
  },

  detailsGrid: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18,
  },

  detailsCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 15,
  },

  smallLabel: {
    fontSize: 7.5,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  strongText: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  text: {
    lineHeight: 1.5,
    color: "#475569",
  },

  detailSpacing: {
    marginTop: 9,
  },

  valuePanel: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  valueLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  valueSubtext: {
    marginTop: 5,
    fontSize: 8.5,
    color: "#64748b",
  },

  valueAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#0f172a",
  },

  section: {
    marginTop: 24,
  },

  sectionHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },

  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: "#0f172a",
  },

  sectionText: {
    marginTop: 12,
    fontSize: 9.5,
    lineHeight: 1.6,
    color: "#475569",
  },

  messageBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  messageTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#0f172a",
  },

  messageText: {
    marginTop: 7,
    lineHeight: 1.55,
    color: "#475569",
  },

  acceptanceBox: {
    marginTop: 26,
    padding: 18,
    borderRadius: 6,
    backgroundColor: "#0f172a",
  },

  acceptanceTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#ffffff",
  },

  acceptanceText: {
    marginTop: 8,
    fontSize: 9,
    lineHeight: 1.55,
    color: "#cbd5e1",
  },

  acceptanceLink: {
    marginTop: 12,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#ffffff",
    textDecoration: "underline",
  },

  signedBox: {
    marginTop: 26,
    padding: 18,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },

  signedTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#065f46",
  },

  signedGrid: {
    marginTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },

  signedColumn: {
    width: "48%",
  },

  signedLabel: {
    fontSize: 7.5,
    color: "#059669",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  signedValue: {
    fontFamily: "Helvetica-Bold",
    color: "#064e3b",
  },

  legalNote: {
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    lineHeight: 1.5,
    color: "#64748b",
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

  /* Same logo size/fit as the quote PDF. */
  logoFull: PDF_LOGO_STYLE,

  companyNameDark: {
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

  docDate: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#64748b",
  },

  detailsRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },

  column: {
    width: "48%",
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

  workTitle: {
    marginTop: 14,
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#0f172a",
  },

  valueBlock: {
    marginTop: 12,
    alignItems: "flex-end",
  },

  valueNote: {
    marginTop: 3,
    fontSize: 9,
    color: "#334155",
  },

  termsWrap: {
    marginTop: 4,
  },

  termsTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 10,
  },

  termsHeading: {
    marginTop: 9,
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    lineHeight: 1.35,
  },

  termsBody: {
    marginTop: 3,
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.4,
  },

  termsGap: {
    height: 6,
  },

  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

export default function ContractPdfDocument({
  logoDataUri,

  contractNumber,
  title,
  status,
  contractDate,

  clientName,
  clientCompanyName,
  clientEmail,
  clientPhone,
  clientAddressLines,

  jobNumber,
  jobTitle,
  propertyAddressLines,

  quoteNumber,

  description,
  terms,
  customerMessage,

  total,

  signedAt,
  signedName,
  signedEmail,

  customerUrl,
}: ContractPdfDocumentProps) {
  const signed =
    status === "Signed" ||
    Boolean(signedAt);

  const companyLine = clientCompanyName?.trim() || "";
  const customerLines = filledLines([
    ...clientAddressLines,
    clientEmail,
    clientPhone,
  ]);
  const siteLines = filledLines(propertyAddressLines);
  const specialTerms = contractSpecialTerms(terms);

  return (
    <Document
      title={`${contractNumber} - ${title}`}
      author="Dry Home Damp Proofing Solutions LTD"
      subject="Works Contract"
    >
      <Page
        size="A4"
        style={styles.page}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {logoDataUri ? (
              <Image src={logoDataUri} style={styles.logoFull} />
            ) : null}

            <View>
              <Text style={styles.companyNameDark}>
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
            <Text style={styles.docLabel}>Contract</Text>
            <Text style={styles.docNumber}>{contractNumber}</Text>
            {contractDate && (
              <Text style={styles.docDate}>
                Date: {formatDate(contractDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.column}>
            <Text style={styles.smallLabel}>Customer</Text>
            <Text style={styles.strongText}>{clientName}</Text>
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
              <Text style={styles.strongText}>{jobNumber}</Text>
            ) : (
              <Text style={styles.text}>No linked job</Text>
            )}
            {jobTitle && (
              <Text style={styles.text}>{jobTitle}</Text>
            )}
            {siteLines.length > 0 && (
              <>
                <Text style={styles.siteLabel}>Site</Text>
                <Text style={styles.addressText}>
                  {siteLines.join("\n")}
                </Text>
              </>
            )}
            {quoteNumber && (
              <Text style={[styles.text, { marginTop: 6 }]}>
                Quotation {quoteNumber}
              </Text>
            )}
          </View>
        </View>

        {title && (
          <Text style={styles.workTitle}>{title}</Text>
        )}

        <View style={styles.valueBlock}>
          <Text style={styles.valueAmount}>
            {formatCurrency(total)}
          </Text>
          <Text style={styles.valueNote}>
            In conjunction with our standard terms.
          </Text>
        </View>

        <PdfSection title="Scope of Works">
          <Text style={styles.sectionText}>
            {description ||
              "No scope of works has been recorded."}
          </Text>
        </PdfSection>

        {specialTerms && (
          <PdfSection title="Special terms">
            <Text style={styles.sectionText}>
              {specialTerms}
            </Text>
          </PdfSection>
        )}

        {customerMessage && (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>
              Message from Dry Home
            </Text>

            <Text style={styles.messageText}>
              {customerMessage}
            </Text>
          </View>
        )}

        {signed ? (
          <View wrap={false} style={styles.signedBox}>
            <Text style={styles.signedTitle}>
              Agreement Confirmed
            </Text>

            <View style={styles.signedGrid}>
              <View style={styles.signedColumn}>
                <Text style={styles.signedLabel}>
                  Signed By
                </Text>

                <Text style={styles.signedValue}>
                  {signedName ||
                    "Customer"}
                </Text>

                {signedEmail && (
                  <Text
                    style={[
                      styles.text,
                      {
                        marginTop: 4,
                        color: "#047857",
                      },
                    ]}
                  >
                    {signedEmail}
                  </Text>
                )}
              </View>

              <View style={styles.signedColumn}>
                <Text style={styles.signedLabel}>
                  Signed
                </Text>

                <Text style={styles.signedValue}>
                  {signedAt
                    ? formatDateTime(
                        signedAt
                      )
                    : "Recorded"}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View wrap={false} style={styles.acceptanceBox}>
            <Text style={styles.acceptanceTitle}>
              Review & Sign Online
            </Text>

            <Text style={styles.acceptanceText}>
              This PDF is a copy of the contract for your records.
              Please use the secure DryHome contract page to review
              and confirm your agreement electronically.
            </Text>

            <Link
              src={customerUrl}
              style={styles.acceptanceLink}
            >
              Open secure contract to sign
            </Link>
          </View>
        )}

        <Text style={styles.legalNote}>
          This document records the scope, value and terms of the
          works agreed with Dry Home Damp Proofing Solutions Ltd.
          Any agreed changes to the works should be recorded
          separately as an authorised variation.
        </Text>

        {/* Standard terms always come last, on their own page. */}
        <StandardTerms />

        <View
          fixed
          style={styles.footer}
        >
          <Text>
            Dry Home Damp Proofing Solutions LTD ·
            dryhomedampproofing.co.uk
          </Text>

          <Text
            render={({
              pageNumber,
              totalPages,
            }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}


function filledLines(
  values: Array<string | null | undefined>
) {
  return values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function StandardTerms() {
  const lines = QUOTE_STANDARD_TERMS.split("\n");

  return (
    <View break style={styles.termsWrap}>
      <Text style={styles.termsTitle}>Terms and conditions</Text>
      {lines.map((line, index) => {
        if (line === "") {
          return <View key={index} style={styles.termsGap} />;
        }

        const isHeading =
          /^\d+\.\s/.test(line) && !/^\d+\.\d+/.test(line);

        return (
          <Text
            key={index}
            style={isHeading ? styles.termsHeading : styles.termsBody}
          >
            {line}
          </Text>
        );
      })}
    </View>
  );
}

function PdfSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>
      </View>

      {children}
    </View>
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(value);
}

function formatDate(
  value: string
) {
  const [year, month, day] =
    value
      .slice(0, 10)
      .split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
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

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/London",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}