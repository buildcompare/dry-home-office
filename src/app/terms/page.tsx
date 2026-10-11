import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { COMPANY, ContactBlock } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use | DryHome Office",
  description: "Terms of use for DryHome Office and its customer document links.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" current="terms">
      <section>
        <h2>About these terms</h2>
        <p>
          These terms cover the use of DryHome Office, the office system of {COMPANY.name} (company number{" "}
          {COMPANY.number}), {COMPANY.address} (&quot;we&quot;, &quot;us&quot;). They apply to:
        </p>
        <ul>
          <li>our staff, who use the signed-in office system; and</li>
          <li>
            customers who use the secure links we email to view and accept quotes and variations, sign
            contracts, and view invoices and guarantees.
          </li>
        </ul>
        <p>By using DryHome Office or one of these links, you agree to these terms.</p>
      </section>

      <section>
        <h2>The works themselves</h2>
        <p>
          These terms cover the software only. The terms for our damp proofing works, payments and guarantees
          are the customer terms and conditions shown on each quote and contract. If there is a conflict, the
          quote or contract terms apply to the works.
        </p>
      </section>

      <section>
        <h2>Customer links</h2>
        <ul>
          <li>
            Each link is private to the customer it was sent to. Please don&apos;t share it with anyone who is
            not entitled to act for you.
          </li>
          <li>
            Accepting a quote or variation, or typing your name to sign a contract, through your link is a
            binding acceptance or signature, the same as signing on paper. We record the date and time and the
            details you enter.
          </li>
          <li>If you think a link has been sent to the wrong person, please tell us straight away.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>try to access records, accounts or links that are not yours;</li>
          <li>interfere with, overload, test the security of or reverse engineer the system;</li>
          <li>upload anything unlawful, harmful or containing malware;</li>
          <li>use the system in a way that breaks the law or harms other people.</li>
        </ul>
        <p>We may suspend access, or cancel a link, if we reasonably believe these terms have been broken.</p>
      </section>

      <section>
        <h2>No warranty for the software</h2>
        <p>
          DryHome Office is provided &quot;as is&quot;. We work to keep it available and accurate but we
          don&apos;t promise it will always be available, free of errors or uninterrupted. If a document in the
          system appears to differ from one we have sent or agreed with you, please contact us.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          As far as the law allows, we are not liable for any loss caused by using, or being unable to use, the
          software, including loss of data, profit or business. Nothing in these terms limits liability for
          death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited
          by law. These terms do not affect your statutory rights as a consumer, or our obligations to you under
          a quote or contract.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          How we use personal data is explained in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms from time to time. The date at the top shows when they were last changed.
        </p>
      </section>

      <section>
        <h2>Law</h2>
        <p>
          These terms are governed by the law of England and Wales, and the courts of England and Wales have
          jurisdiction.
        </p>
      </section>

      <section>
        <h2>Contact us</h2>
        <ContactBlock />
      </section>
    </LegalPage>
  );
}
