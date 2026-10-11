import type { Metadata } from "next";
import LegalPage, { COMPANY, ContactBlock } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | DryHome Office",
  description: "How Dry Home Damp Proofing Solutions Ltd uses personal data in DryHome Office.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" current="privacy">
      <section>
        <h2>Who we are</h2>
        <p>
          DryHome Office is the internal office system of {COMPANY.name} (company number {COMPANY.number}),{" "}
          {COMPANY.address}. We are the controller of the personal data described here under the UK General Data
          Protection Regulation (UK GDPR) and the Data Protection Act 2018.
        </p>
        <p>
          This policy explains what DryHome Office stores, why, who helps us run it, and the rights you have.
        </p>
      </section>

      <section>
        <h2>What we collect and why</h2>
        <p>To provide our damp proofing services we store:</p>
        <ul>
          <li>Client contact details: names, email addresses, phone numbers and property addresses.</li>
          <li>
            Job records: surveys, quotes, contracts, variations, invoices and payments, guarantees, survey reports,
            appointments and notes about the work.
          </li>
          <li>
            Records of when we email you a document and when you open, accept or sign it through your secure link
            (for example the date, time and the name typed when signing).
          </li>
          <li>Staff sign-in details for the people at {COMPANY.name} who use the system.</li>
        </ul>
        <p>
          Our lawful bases are: performing a contract with you or taking steps at your request before entering
          one (quotes, surveys, works, invoices and guarantees); complying with legal obligations (for example
          tax and accounting records); and our legitimate interests in running and improving our business and
          keeping accurate records.
        </p>
      </section>

      <section>
        <h2>Google Calendar</h2>
        <p>
          Staff can connect a Google account so that work appointments appear in DryHome Office and in their
          Google Calendar. DryHome Office asks only for the{" "}
          <code className="rounded bg-slate-100 px-1">calendar.events</code> permission and uses it only to show
          and two-way sync work appointments: reading events in the connected calendar for the dates being viewed,
          and creating, updating or deleting the appointments that DryHome Office manages.
        </p>
        <p>
          DryHome Office&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <ul>
          <li>Google data is not sold.</li>
          <li>Google data is not used for advertising.</li>
          <li>
            Google data is not shared with anyone, except as needed to provide this calendar feature (it is stored
            with our hosting providers listed below), or where the law requires it.
          </li>
          <li>People do not read your Google Calendar data except to fix a problem you report, or where the law requires it.</li>
        </ul>
        <p>
          You can remove DryHome Office&apos;s access at any time at{" "}
          <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer">
            https://myaccount.google.com/permissions
          </a>
          . Appointments already copied into DryHome Office stay in our schedule until they are deleted.
        </p>
      </section>

      <section>
        <h2>Who helps us run DryHome Office</h2>
        <p>We use these service providers, who process data on our behalf under contract:</p>
        <ul>
          <li>Vercel: hosts the DryHome Office website.</li>
          <li>Supabase: stores the database and files such as survey reports.</li>
          <li>Resend: sends our emails, and may tell us whether an email was delivered or opened.</li>
          <li>Google: calendar sync, only when a staff member connects their Google account.</li>
        </ul>
        <p>
          Some of these providers may process data outside the UK. Where they do, we rely on the safeguards
          allowed by UK data protection law, such as UK adequacy regulations or the International Data Transfer
          Addendum to the standard contractual clauses.
        </p>
        <p>We do not sell personal data.</p>
      </section>

      <section>
        <h2>Email tracking</h2>
        <p>
          When we email you a document we may record whether the email was delivered, opened or a link was
          clicked, and when you open your secure link. This helps us know you have received important documents.
          Open tracking is approximate and can be blocked by your email app.
        </p>
      </section>

      <section>
        <h2>How long we keep data</h2>
        <p>
          We keep client, job and financial records for as long as we need them to provide our services and
          guarantees, and to meet legal requirements. Financial records are normally kept for at least six years
          after the end of the financial year they relate to. Guarantee records are kept for as long as the
          guarantee lasts, and for a reasonable period afterwards in case of a claim. Google Calendar access is kept until it is disconnected or removed. When data
          is no longer needed, we delete it or make it anonymous.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>Under UK GDPR you have the right to:</p>
        <ul>
          <li>ask for a copy of your personal data;</li>
          <li>ask us to correct data that is wrong or incomplete;</li>
          <li>ask us to delete your data, where we no longer need to keep it;</li>
          <li>ask us to restrict how we use your data, or object to our use of it;</li>
          <li>ask for your data in a portable format, where this applies.</li>
        </ul>
        <p>
          To use any of these rights, contact us using the details below. We will reply within one month. There is
          normally no charge.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Access to DryHome Office is limited to signed-in staff. Customer documents are shared through private
          links that are hard to guess, and data is sent over encrypted connections.
        </p>
      </section>

      <section>
        <h2>Complaints</h2>
        <p>
          If you are unhappy with how we have used your data, please contact us first so we can try to put it
          right. You also have the right to complain to the Information Commissioner&apos;s Office (ICO), the UK
          data protection regulator: <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>{" "}
          or 0303 123 1113.
        </p>
      </section>

      <section>
        <h2>Contact us</h2>
        <ContactBlock />
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. The date at the top shows when it was last changed.
        </p>
      </section>
    </LegalPage>
  );
}
