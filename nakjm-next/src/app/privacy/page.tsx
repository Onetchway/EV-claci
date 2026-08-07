import { buildMetadata } from "@/lib/seo";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { site } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How NAKJM Infrastructure Pvt. Ltd. collects, uses and protects the information you share with us.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="6 August 2026">
      <h2>Who we are</h2>
      <p>
        {site.legalName} (&ldquo;NAKJM&rdquo;, &ldquo;we&rdquo;) operates{" "}
        {site.url}. Our registered office is {site.address.street},{" "}
        {site.address.locality} — {site.address.postalCode}, India. For any
        privacy question, write to{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        We collect only what you choose to send us. When you submit the enquiry
        form that is your name, company, work email, phone number, project type,
        indicative budget, site location, your message, and any drawings you
        attach. If you email or call us directly, we hold whatever that
        correspondence contains.
      </p>
      <p>
        Where analytics are enabled we also receive standard, aggregated
        measurement data — pages viewed, approximate region, device and
        referrer. This is configured with IP anonymisation and is not used to
        identify individuals.
      </p>

      <h2>Why we hold it</h2>
      <p>
        To respond to your enquiry, prepare a feasibility view or quotation, and
        to carry out any contract that follows. We do not sell your data, we do
        not share it with advertisers, and we do not use it to send marketing you
        did not ask for.
      </p>

      <h2>Who can see it</h2>
      <p>
        Our own engineering and commercial staff, and the service providers who
        host this site and deliver our email. Those providers process data on our
        instructions only. We disclose information to authorities only where the
        law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Enquiries that do not proceed are retained for 24 months so we can pick
        up a conversation you may return to. Project records are retained for the
        statutory period applicable to construction contracts in India.
      </p>

      <h2>Your rights</h2>
      <p>
        You may ask us for a copy of what we hold about you, ask us to correct
        it, or ask us to delete it where we have no legal obligation to keep it.
        Email <a href={`mailto:${site.email}`}>{site.email}</a> and we will
        respond within 30 days.
      </p>

      <h2>Cookies</h2>
      <p>
        This site sets no advertising or profiling cookies. Where analytics are
        enabled, the measurement provider sets its own first-party cookies; you
        can block these in your browser without any loss of functionality on this
        site.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the revision date at the
        top of this page.
      </p>
    </LegalLayout>
  );
}
