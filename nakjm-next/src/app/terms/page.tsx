import { buildMetadata } from "@/lib/seo";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { site } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Terms of Use",
  description: "The terms on which NAKJM Infrastructure Pvt. Ltd. makes this website available.",
  path: "/terms/",
});

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated="6 August 2026">
      <h2>Acceptance</h2>
      <p>
        By using {site.url} you accept these terms. If you do not accept them,
        please do not use the site.
      </p>

      <h2>What this site is</h2>
      <p>
        This site describes the services of {site.legalName}. Content is provided
        for general information. Nothing here is an offer capable of acceptance,
        a quotation, or engineering advice for a specific site. Project figures,
        capacities and values describe completed work and are not a guarantee of
        outcomes on any other project.
      </p>

      <h2>Enquiries and quotations</h2>
      <p>
        Submitting the enquiry form starts a conversation. It does not create a
        contract. Any engagement between us is governed solely by a signed
        written agreement, and in the event of conflict that agreement prevails
        over anything stated on this site.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The NAKJM name, logo, page designs, text and photography on this site
        belong to {site.legalName} or are used with permission. You may not
        reproduce, republish or adapt them for commercial purposes without our
        written consent.
      </p>
      <p>
        Client names, brand marks and logos shown on this site remain the
        property of their respective owners and appear solely to identify work we
        have carried out. Their appearance is not an endorsement by those owners.
      </p>

      <h2>Third-party links</h2>
      <p>
        Where we link to another site — including our social media profiles and
        WhatsApp — we are not responsible for its content or its handling of your
        data.
      </p>

      <h2>Liability</h2>
      <p>
        We take reasonable care to keep this site accurate and available, but we
        do not warrant that it will be uninterrupted or error-free. To the extent
        permitted by law we exclude liability for loss arising from reliance on
        the content of this site.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts at New
        Delhi have exclusive jurisdiction over any dispute arising from them.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalLayout>
  );
}
