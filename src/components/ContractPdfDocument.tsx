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

type ContractPdfDocumentProps = {
  logoDataUri?: string | null;

  contractNumber: string;
  title: string;
  status: string;
  contractDate: string | null;

  clientName: string;
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
  clientEmail,
  clientPhone,
  clientAddressLines,

  jobNumber,
  jobTitle,
  jobType,
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
        <View style={styles.hero}>
          <View style={styles.heroRow}>
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

            <View style={styles.heroRight}>
              <Text style={styles.documentLabel}>
                Works Contract
              </Text>

              <Text style={styles.contractNumber}>
                {contractNumber}
              </Text>

              {contractDate && (
                <Text style={styles.contractDate}>
                  {formatDate(contractDate)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.titleArea}>
            <Text style={styles.eyebrow}>
              Contract for Works
            </Text>

            <Text style={styles.contractTitle}>
              {title || "Customer Contract"}
            </Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {signed
                  ? "Signed"
                  : status || "Contract"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailsCard}>
            <Text style={styles.smallLabel}>
              Customer
            </Text>

            <Text style={styles.strongText}>
              {clientName}
            </Text>

            {clientAddressLines.map(
              (line, index) => (
                <Text
                  key={`${line}-${index}`}
                  style={styles.text}
                >
                  {line}
                </Text>
              )
            )}

            {clientEmail && (
              <Text
                style={[
                  styles.text,
                  styles.detailSpacing,
                ]}
              >
                {clientEmail}
              </Text>
            )}

            {clientPhone && (
              <Text style={styles.text}>
                {clientPhone}
              </Text>
            )}
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.smallLabel}>
              Property / Job
            </Text>

            {jobNumber && (
              <Text style={styles.strongText}>
                {jobNumber}
              </Text>
            )}

            {jobTitle && (
              <Text style={styles.text}>
                {jobTitle}
              </Text>
            )}

            {jobType && (
              <Text style={styles.text}>
                {jobType}
              </Text>
            )}

            {propertyAddressLines.length >
              0 && (
              <View style={styles.detailSpacing}>
                {propertyAddressLines.map(
                  (line, index) => (
                    <Text
                      key={`${line}-${index}`}
                      style={styles.text}
                    >
                      {line}
                    </Text>
                  )
                )}
              </View>
            )}

            {quoteNumber && (
              <View style={styles.detailSpacing}>
                <Text style={styles.smallLabel}>
                  Original Quotation
                </Text>

                <Text style={styles.strongText}>
                  {quoteNumber}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.valuePanel}>
          <View>
            <Text style={styles.valueLabel}>
              Contract Value
            </Text>

            <Text style={styles.valueSubtext}>
              Agreed value of the contracted works
            </Text>
          </View>

          <Text style={styles.valueAmount}>
            {formatCurrency(total)}
          </Text>
        </View>

        <PdfSection title="Scope of Works">
          <Text style={styles.sectionText}>
            {description ||
              "No scope of works has been recorded."}
          </Text>
        </PdfSection>

        <PdfSection title="Terms & Conditions">
          <Text style={styles.sectionText}>
            {terms ||
              "No terms and conditions have been recorded."}
          </Text>
        </PdfSection>

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
          <View style={styles.signedBox}>
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
          <View style={styles.acceptanceBox}>
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
          works agreed with Dry Home Damp Proofing Solutions LTD.
          Any agreed changes to the works should be recorded
          separately as an authorised variation.
        </Text>

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