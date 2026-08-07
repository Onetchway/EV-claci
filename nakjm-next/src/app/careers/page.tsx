import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { jobs } from "@/lib/data/company";
import { site } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Careers",
  description:
    "Join a 50+ strong in-house civil and electrical team building India's charging backbone. Open roles across engineering, commissioning, fabrication and HSE.",
  path: "/careers/",
  image: "/images/trenching.webp",
});

export default function CareersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Careers", path: "/careers/" },
        ])}
      />

      <PageHero
        eyebrow="Careers"
        title="Build things that"
        accent="stay built."
        lede="We hire people onto our own payroll, not onto a project. That is why our crews get better every year instead of starting over on every site."
        image="/images/trenching.webp"
        imageAlt="NAKJM crew executing precision cable trenching"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Careers", href: "/careers/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          <SectionHeading
            eyebrow="Why here"
            title="In-house means"
            accent="invested in."
            lede="Subcontracted crews are assembled and dispersed. Ours are trained, licensed, equipped and kept — which is the only way tolerances hold across three hundred sites."
          />

          <RevealGroup className="mt-16 grid gap-px border border-navy/10 bg-navy/10 md:grid-cols-3" stagger={0.09}>
            {[
              { t: "Real progression", d: "Site engineer to commissioning lead to programme command — internal, and common." },
              { t: "Equipment that works", d: "Own plant, own fabrication, own test bench. You are not waiting on a hire company." },
              { t: "Safety without exception", d: "100% PPE compliance and continuous hazard mitigation. Non-negotiable, every site." },
            ].map((c) => (
              <RevealItem key={c.t} className="bg-white p-9 lg:p-12">
                <h3 className="text-xl font-medium tracking-tight text-navy">{c.t}</h3>
                <p className="mt-4 text-ink/55">{c.d}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="bg-mist py-section">
        <div className="shell">
          <SectionHeading eyebrow="Open roles" title="Where we are" accent="hiring now." />

          <RevealGroup className="mt-14 border-t border-navy/10" stagger={0.06}>
            {jobs.map((job) => (
              <RevealItem key={job.title}>
                <a
                  href={`mailto:${site.email}?subject=${encodeURIComponent(`Application — ${job.title}`)}&body=${encodeURIComponent(`Hello NAKJM Team,\n\nI would like to apply for the ${job.title} role.\n\n`)}`}
                  className="group grid items-baseline gap-x-8 gap-y-2 border-b border-navy/10 py-8 md:grid-cols-[1.4fr_1fr_1fr_auto] md:py-10"
                >
                  <h3 className="text-xl font-medium tracking-tight text-navy transition-transform duration-500 ease-editorial md:group-hover:translate-x-2">
                    {job.title}
                  </h3>
                  <span className="text-sm text-ink/45">{job.location}</span>
                  <span className="text-sm text-ink/45">
                    {job.type} · {job.experience}
                  </span>
                  <span className="text-eyebrow uppercase text-crimson opacity-0 transition-opacity duration-400 group-hover:opacity-100">
                    Apply →
                  </span>
                </a>
              </RevealItem>
            ))}
          </RevealGroup>

          <p className="mt-12 max-w-measure text-ink/55">
            Nothing listed that fits? Send your CV to{" "}
            <a href={`mailto:${site.email}`} className="text-crimson underline underline-offset-4">
              {site.email}
            </a>{" "}
            — we keep good engineers on file and call them when a programme opens.
          </p>
        </div>
      </section>
    </>
  );
}
