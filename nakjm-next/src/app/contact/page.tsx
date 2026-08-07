import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { site } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Contact",
  description:
    "Send us the site, the sanctioned load and the timeline. NAKJM returns a feasibility view and a single-contract delivery plan.",
  path: "/contact/",
  image: "/images/hub-vinfast.webp",
});

const contactFaqs = [
  { q: "How quickly does NAKJM respond to an enquiry?", a: "Within one working day. Urgent site matters are better handled by phone on +91 99715 35940." },
  { q: "What information helps NAKJM quote accurately?", a: "Site location, sanctioned or required load, number of charge points or built-up area, and your target timeline. Drawings in PDF or DWG shorten the process considerably." },
  { q: "Does NAKJM work outside Delhi NCR?", a: "Yes. We run a standard 100 km operational radius from our Delhi NCR command centre plus dedicated outstation crews for multi-state rollouts across India." },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          faqSchema(contactFaqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact/" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Contact"
        title="Building the"
        accent="new energy era."
        lede="Send us the site, the sanctioned load and the timeline. We come back with a feasibility view and a single-contract delivery plan."
        image="/images/hub-vinfast.webp"
        imageAlt="VinFast OEM delivery hub delivered by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Contact", href: "/contact/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell grid gap-20 lg:grid-cols-[1fr_1.35fr] lg:gap-28">
          {/* details column */}
          <div>
            <span className="eyebrow">Reach us</span>
            <h2 className="mt-7 text-title text-navy">{site.legalName}</h2>
            <p className="mt-5 text-ink/55">Next-generation mega-builders.</p>

            <dl className="mt-14 space-y-10">
              <div>
                <dt className="text-eyebrow uppercase text-ink/35">Head office</dt>
                <dd className="mt-3 text-lg leading-relaxed text-navy">
                  CoWynd Managed Office, First Floor,
                  <br />
                  Plot 103, Dwarka Sector 19,
                  <br />
                  New Delhi — 110075
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow uppercase text-ink/35">Phone</dt>
                <dd className="mt-3">
                  <a href={`tel:${site.phoneHref}`} className="text-lg text-navy transition-colors hover:text-crimson">
                    {site.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow uppercase text-ink/35">Email</dt>
                <dd className="mt-3">
                  <a href={`mailto:${site.email}`} className="text-lg text-navy transition-colors hover:text-crimson">
                    {site.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow uppercase text-ink/35">Follow</dt>
                <dd className="mt-3 flex flex-wrap gap-6">
                  <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" className="link-sweep text-navy">LinkedIn</a>
                  <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="link-sweep text-navy">Instagram</a>
                  <a href={site.social.youtube} target="_blank" rel="noopener noreferrer" className="link-sweep text-navy">YouTube</a>
                </dd>
              </div>
            </dl>

            <p className="mt-14 border-l-2 border-crimson pl-6 text-sm text-ink/55">
              <strong className="font-medium text-navy">Operating footprint:</strong>{" "}
              command centre in Delhi NCR, executing standard 100 km operational
              radiuses and dedicated outstation multi-state rollouts. Fully
              licensed, night-shift capable and ready for on-demand crew
              expansion.
            </p>
          </div>

          {/* form column */}
          <div>
            <span className="eyebrow">Project enquiry</span>
            <h2 className="mt-7 text-title text-navy">Start a conversation.</h2>
            <div className="mt-12">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-mist py-section">
        <div className="shell">
          <span className="eyebrow">Common questions</span>
          <div className="mt-12 border-t border-navy/10">
            {contactFaqs.map((f) => (
              <details key={f.q} className="group border-b border-navy/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-7 text-lg font-medium tracking-tight text-navy marker:hidden">
                  {f.q}
                  <span aria-hidden className="relative h-3 w-3 shrink-0">
                    <span className="absolute left-0 top-1.5 h-px w-3 bg-crimson" />
                    <span className="absolute left-1.5 top-0 h-3 w-px bg-crimson transition-transform duration-300 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="max-w-measure pb-7 text-ink/55">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
