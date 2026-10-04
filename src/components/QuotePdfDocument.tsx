import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { additionalQuoteTerms } from "@/lib/quote-additional-terms";

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

  logo: {
    width: 104,
    height: 104,
    objectFit: "contain",
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

  additionalTerms: {
    marginTop: 16,
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

        <QuoteTerms additional={additionalQuoteTerms(terms)} />

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


const QUOTE_TERMS = '1. About us and who your contract is with\n\n1.1 These terms cover the work we carry out for you. "We", "us" and "our" means DryHome Damp Proofing Solutions. "You" and "your" means the person or organisation named on our quotation.\n\n1.2 Our trading details:\n\n- Trading name: DryHome Damp Proofing Solutions\n- Legal entity: Dry Home Damp Proofing Solutions Ltd\n- Company number: 16804053\n- Telephone: 0118 9740020 (Monday to Friday, 8.30am to 6pm)\n- Email: contact@dryhomedampproofing.co.uk\n- VAT: not registered. No VAT is added to the price.\n\n1.3 We work for homeowners, landlords and commercial clients. If you are a consumer (an individual acting mainly for purposes outside your trade or business), these terms apply alongside your legal rights, and nothing in them takes those rights away. Clause 16 contains some extra terms that apply only to business customers.\n\n2. Surveys and what they can and cannot tell us\n\n2.1 Before we quote, we will normally inspect the property. The survey fee is £300. It is payable for the survey itself. It is not refunded, and it is not taken off the price of the work if you go ahead.\n\n2.2 Our survey is a specialist inspection of damp, condensation, mould, timber decay, woodworm or insulation issues in the areas we were asked to look at and could reach safely. It is not a structural survey, a building survey or a mortgage valuation.\n\n2.3 A survey can be invasive where that is needed to find the cause, for example by opening up an area. We will tell you before we do anything invasive. We cannot report on parts of the property we could not see or reach, and we will say in our report which areas we could not inspect.\n\n2.4 Electronic moisture meters are a useful guide but they can give misleading readings, for example where walls contain salts, foil-backed materials or certain paints. Where the cause is unclear we may recommend further investigation, such as taking samples, before we give a firm price.\n\n2.5 We will use reasonable care and skill in carrying out the survey and in our diagnosis. If something comes to light once work starts that could not reasonably have been spotted at survey, clause 4 (changes to the work) applies.\n\n3. Quotations and how a contract is formed\n\n3.1 Our quotation will set out the work we propose, the price, what is included and what is not. Please read it carefully, together with these terms.\n\n3.2 A quotation is valid for 30 days from its date, unless it says otherwise. After that we may need to revisit the price.\n\n3.3 A quotation is a fixed price for the work described in it, unless it clearly says that an item is an estimate or a provisional sum. Provisional sums are our best guess for work that cannot be fully measured until it is opened up, and we will confirm the actual cost with you before doing that work.\n\n3.4 The contract between us starts when you press the accept button in the email we send you with the quotation. We will confirm that acceptance to you in writing (email is fine).\n\n3.5 If anything you have been told verbally differs from the written quotation, please raise it before you accept, so we can put it in writing.\n\n4. The work and changes to it\n\n4.1 We will carry out the work described in the quotation, using reasonable care and skill and suitable materials applied in line with the manufacturer\'s instructions and good industry practice.\n\n4.2 Unless the quotation says otherwise, the price does not include:\n\n- redecoration, such as painting or wallpapering, after replastering;\n- removing or refitting kitchens, bathrooms, radiators, built-in furniture, skirting boards or electrical fittings;\n- fixing defects outside the scope of the work, such as roof leaks, faulty gutters or downpipes, plumbing leaks, raised ground levels or defective render.\n\n4.3 Sometimes we only find the full extent of the problem once work begins, for example extra timber decay behind plaster. If that happens we will stop that part of the work, explain what we have found, and give you a price for the extra work. We will not go ahead with it without your agreement, except where we must act straight away to keep the property or people safe, in which case we will do only what is needed and tell you as soon as possible.\n\n4.4 If you ask us to change the work, we will tell you how the change affects the price and the timetable before we carry it out. Changes will be confirmed in writing (email or text is fine).\n\n4.5 We may make small changes to the work or materials if they are needed to comply with the law or building regulations, or if a product becomes unavailable, provided the change does not lower the quality of the work or increase the price without your agreement.\n\n4.6 We may use our own qualified staff or carefully chosen subcontractors. We remain responsible for their work.\n\n5. Your responsibilities and access\n\n5.1 To let us work safely and efficiently, you agree to:\n\n- give us access to the property and the work areas on the agreed dates, along with free use of electricity and water;\n- clear the work areas of furniture, carpets, curtains, belongings and pets, unless we have agreed to do this for you;\n- tell us about anything relevant you know of, such as the position of hidden pipes and cables, previous treatments or guarantees, and any asbestos-containing materials;\n- obtain any permission needed before the work starts, such as consent from a landlord, freeholder or mortgage lender, or listed building or conservation area consent; and\n- follow the aftercare advice we give you, including any period during which rooms should be kept clear or ventilated after treatment.\n\n5.2 Properties built before 2000 may contain asbestos. If we suspect asbestos in an area we need to disturb, we will stop work in that area until it has been tested and, if needed, dealt with by a licensed specialist. You arrange that testing and you pay for it.\n\n5.3 Some timber and damp treatments mean that people and pets should keep out of the treated area for a period after application. We will tell you in advance how long, based on the product we are using.\n\n5.4 If we cannot start or carry on because access is not given, the area is not ready, or permissions are missing, we may need to rebook. We do not charge a wasted-visit fee.\n\n6. Price and payment\n\n6.1 The price is set out in the quotation. We are not VAT registered, so no VAT is added. The price shown on the quotation is the full price you pay.\n\n6.2 Deposit: 35% of the total price. A deposit is a payment towards the price, not an extra charge. If you cancel within the cooling-off period under clause 7, it will be refunded in line with that clause.\n\n6.3 Final payment is due on receipt of the invoice, on completion unless interim payments apply. For larger jobs, we will ask for interim payments. Any stage payments set out in the quotation are a term of the contract.\n\n6.4 Payment is by bank transfer. Bank details are never changed by email alone. Please call us on 0118 9740020 to check before paying to any new account.\n\n6.5 If you have a genuine concern about part of the work, please tell us promptly. You may hold back a fair amount relating to that part while we look into it, but please pay the rest on time.\n\n6.6 If you are a consumer and you pay late, we do not add extra interest. For business customers, see clause 16.\n\n6.7 Materials we supply remain ours until the price for them has been paid, but the risk of damage to them passes to you once they are fixed into your property.\n\n7. Your right to cancel (consumers)\n\n7.1 If you are a consumer and the contract was made away from our business premises (for example at your home during or after a survey) or at a distance (for example by phone, email or online, without us meeting face to face at our premises), you have a legal right to cancel within 14 days of the day the contract is made, without giving a reason. This comes from the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.\n\n7.2 To cancel, tell us clearly in writing or by phone before the 14 days run out, using the contact details in clause 1. You can use the model cancellation form at the end of these terms, but you do not have to.\n\n7.3 If you cancel in time, we will refund all payments you have made within 14 days of being told you are cancelling, using the same payment method, subject to clause 7.4.\n\n7.4 If you want work to start within the 14 days. We will not start during the cancellation period unless you expressly ask us to, in writing. If you do ask us to start early:\n\n- you can still cancel during the 14 days, but you will have to pay a fair amount for the work done up to the point you tell us you are cancelling, worked out in proportion to the full price; and\n- if we complete the work in full within the 14 days, you will lose your right to cancel, provided you asked us to start early and confirmed you understood you would lose that right once the work was complete.\n\n7.5 If you need us to come out urgently to carry out repairs or maintenance, and you have asked us to visit for that purpose, the right to cancel may not apply to that urgent work. Any other work we offer you on the same visit is still covered by your cancellation rights.\n\n7.6 The 14-day right does not apply to contracts made at our business premises. However, see clause 7.7.\n\n7.7 Cancelling after the cooling-off period. You can still ask to end the contract at any time before the work is complete. We will refund any payments you have made, less: (a) the price of work already done; (b) materials ordered specially for your job that we cannot cancel or reuse; and (c) any other genuine loss we suffer because you cancelled, which will be a real estimate of that loss and not a penalty. We will show you how we have worked out any deduction.\n\n8. Our right to cancel or pause\n\n8.1 We may pause or end the contract if:\n\n- you do not pay an amount when it is due and still have not paid within 7 days of us reminding you in writing;\n- the site is unsafe for us to work on and the problem is not put right within a reasonable time; or\n- events outside our reasonable control (see clause 9) stop us carrying out the work for a long period.\n\n8.2 If we end the contract and you have done nothing wrong, we will refund any money you have paid for work we have not done. If we end it because you are at fault, you must pay for the work done so far and for any reasonable losses that result.\n\n9. Start dates, timings and delays\n\n9.1 We will agree a start date and an estimated duration with you. We will do our best to meet them and, if no time is agreed, we will carry out the work within a reasonable time.\n\n9.2 Damp-proofing and plastering work can be affected by weather, drying times, the condition of the building once opened up and the availability of materials. If we are going to be late, we will tell you as soon as we can, explain why, and give you a revised date.\n\n9.3 We are not responsible for delays caused by events outside our reasonable control, such as severe weather, supplier failures we could not reasonably avoid, illness, or delays caused by others working at the property. If such a delay goes on for a long time, either of us may end the contract and you will receive a refund for any work paid for but not done.\n\n9.4 If the delay is our fault and is significant, you may be entitled to a remedy under clause 12.\n\n10. Completion and aftercare\n\n10.1 When we finish, we will remove our own tools, materials and waste, and leave the work areas clean and tidy. Taking our waste away is included.\n\n10.2 We will give you written aftercare advice. Some important points to know:\n\n- new plaster needs time to dry before it is decorated, often several weeks or longer. We will advise you on drying times and suitable finishes;\n- walls treated for rising damp can take months to dry out fully, and some salt staining may appear as they do;\n- condensation and mould are closely linked to heating and ventilation in the home. Treatment will be most effective if you follow our advice on ventilation, heating and moisture control; and\n- our work does not stop new damp caused by things outside the work, such as a burst pipe, a leaking gutter or a newly raised flower bed against the wall.\n\n11. Our guarantee\n\n11.1 Our guarantee is in addition to your legal rights. It does not replace or reduce them.\n\n11.2 Where the quotation says a treatment is covered, the guarantee is between 5 and 20 years. That applies to every treatment category. The period depends on the products used and on the survey, and it is set out in the quotation and on the guarantee certificate.\n\n11.3 If the treated problem returns in the treated area because our treatment failed, we will inspect and, where our work is at fault, put it right free of charge.\n\n11.4 The guarantee is insurance-backed, so it can still be claimed if we stop trading. The insurer\'s name and how to claim are set out on the guarantee certificate, not in these terms.\n\n11.5 The guarantee does not pass to a new owner if the property is sold. It stays with the customer named on the guarantee certificate.\n\n11.6 The guarantee becomes valid once the work has been paid for in full. We will give you a written guarantee certificate setting out the full guarantee terms. If anything in the certificate conflicts with this clause, the term that is better for you applies.\n\n11.7 The guarantee does not cover problems caused by:\n\n- damage or defects in parts of the building we did not treat;\n- new sources of moisture after our work, such as plumbing leaks, roof or gutter failure, flooding, or raised ground levels;\n- condensation caused by how the property is heated and ventilated, unless our guarantee says otherwise;\n- later alterations or damage to the treated area by others; or\n- failing to follow our written aftercare advice, where that failure caused the problem.\n\n11.8 To make a claim, contact us using the details in clause 1, quoting your guarantee certificate. We will arrange an inspection within 10 working days.\n\n12. Your legal rights and what happens if something goes wrong\n\n12.1 If you are a consumer, the Consumer Rights Act 2015 says that we must:\n\n- carry out the work with reasonable care and skill;\n- do what we have told you, in writing or verbally, that we will do, where you have relied on it in deciding to go ahead or in deciding about the work;\n- charge a reasonable price if no price was agreed in advance; and\n- complete the work within a reasonable time if no time was agreed.\n\n12.2 If any of our work does not meet these standards, please tell us as soon as you can. You are entitled to ask us to redo or fix the work at no cost to you, within a reasonable time and without significant inconvenience. If we cannot do that, or cannot do it within a reasonable time, you may be entitled to a price reduction, which may be up to the full price.\n\n12.3 For more information about your rights, contact Citizens Advice (citizensadvice.org.uk, or 0808 223 1133).\n\n13. Our responsibility for loss or damage\n\n13.1 If we fail to keep to these terms, we are responsible for loss or damage you suffer that is a foreseeable result of our failure or our failure to use reasonable care and skill. Loss or damage is foreseeable if it is obvious it will happen, or if both of us knew it might happen when the contract was made.\n\n13.2 We will make good any damage to your property that we cause while carrying out the work.\n\n13.3 We do not exclude or limit our liability in any way for:\n\n- death or personal injury caused by our negligence or the negligence of our staff or subcontractors;\n- fraud or fraudulent misrepresentation;\n- breach of your legal rights as a consumer, including your rights to services carried out with reasonable care and skill; or\n- anything else that cannot be excluded or limited by law.\n\n13.4 We are not responsible for:\n\n- losses that were not foreseeable, or that did not result from our failure;\n- defects in parts of the building that were outside the scope of our work, or that we told you about and you chose not to have put right;\n- reasonable and unavoidable disturbance that is a normal part of the work, such as dust, noise, or minor marks to decoration next to the work area. We will take reasonable care to keep this to a minimum, including using dust sheets; or\n- if you are a consumer, business losses, as we supply services to you for domestic and private use.\n\n13.5 We hold public liability insurance. We will tell you the insurer and the level of cover on request.\n\n14. Complaints\n\n14.1 We want you to be happy with our work. If you are not, please contact us first by phone on 0118 9740020 or by email at contact@dryhomedampproofing.co.uk.\n\n14.2 We will acknowledge your complaint within 5 working days and aim to give you a full response within 14 working days. If we need to visit the property to look into it, we will arrange this with you.\n\n14.3 If we cannot resolve the problem between us, we are not a member of an alternative dispute resolution scheme or a trade association complaints service. You can contact Citizens Advice for guidance, and you have the right to go to court.\n\n15. Your personal information\n\n15.1 We use your personal information only to provide our services, manage our guarantees and keep the records we are required by law to keep. For details, ask us for a copy of our privacy notice.\n\n16. Extra terms for business and commercial customers\n\n16.1 This clause applies only if you are contracting in the course of a business, including landlords with commercial or multiple lettings, managing agents and developers. Clauses 7 (consumer cancellation rights) and 12 (Consumer Rights Act remedies) do not apply to you, but the work must still be carried out with reasonable care and skill.\n\n16.2 Unless the quotation says otherwise, payment is due on receipt of the invoice. We may claim interest and compensation on late payments under the Late Payment of Commercial Debts (Interest) Act 1998.\n\n16.3 We are not liable for loss of profit, loss of revenue, loss of rent, loss of business or any indirect or consequential loss.\n\n16.4 Our total liability to you arising from the contract will not exceed the price of that contract, except for liability that cannot be limited by law (see clause 13.3).\n\n16.5 If the work is carried out under a main contract or a standard-form building contract, the terms of that contract will apply only if we have agreed to them in writing.\n\n17. General\n\n17.1 If a court finds part of these terms unenforceable, the rest will still apply.\n\n17.2 If we do not insist on a term straight away, we can still insist on it later.\n\n17.3 The contract is between you and us. No one else has the right to enforce it, The guarantee does not pass to a later owner of the property.\n\n17.4 These terms are governed by the law of England and Wales. If you are a consumer, you can bring proceedings in the courts of England and Wales, or, if you live in Scotland or Northern Ireland, in the courts of the place where you live. Business customers agree that the courts of England and Wales have exclusive jurisdiction.';

function QuoteTerms({
  additional,
}: {
  additional: string | null;
}) {
  const lines = QUOTE_TERMS.split("\n");

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

      {additional && (
        <View style={styles.additionalTerms}>
          <Text style={styles.termsHeading}>
            Additional terms and conditions
          </Text>
          {additional.split("\n").map((line, index) => (
            <Text key={index} style={styles.termsBody}>
              {line || " "}
            </Text>
          ))}
        </View>
      )}
    </View>
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
