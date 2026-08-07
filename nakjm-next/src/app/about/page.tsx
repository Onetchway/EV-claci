import Image from "next/image";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Timeline } from "@/components/home/Timeline";
import { CtaBanner } from "@/components/home/CtaBanner";
import { Counter } from "@/components/ui/Counter";
import { stats } from "@/lib/site";

export const metadata = buildMetadata({
  title: "About",
  description:
    "From a first charger in 2013 to 1,000+ installed. NAKJM Infrastructure's journey, mission, values and the 50+ strong in-house team behind every site.",
  path: "/about/",
  image: "/images/tesla-super.jpg",
});

const values = [
  {
    no: "01",
    title: "Precision execution",
    body: "Absolute adherence to engineering tolerances — on the pad, in the panel and at the connection. A site that is 10 mm out is a site that gets rebuilt.",
  },
  {
    no: "02",
    title: "Unified accountability",
    body: "One central command for the total project lifecycle. No handoffs between vendors, no gap for a programme to fall into, no finger-pointing when it does.",
  },
  {
    no: "03",
    title: "Hardware agnosticism",
    body: "Flawless integration of any tier-1 OEM equipment. We integrate rather than resell, so your hardware choice stays entirely yours.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "About", path: "/about/" },
        ])}
      />

      <PageHero
        eyebrow="Our company"
        title="From first charger"
        accent="to 1,000 and counting."
        lede="NAKJM Infrastructure has been building since 2013 — civil construction first, then the charging backbone of India's EV transition. Same in-house teams, every site."
        image="/images/tesla-super.jpg"
        imageAlt="Tesla Supercharger installation delivered by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about/" },
        ]}
      />

      {/* mission / vision as editorial columns */}
      <section className="bg-white py-section">
        <div className="shell grid gap-16 lg:grid-cols-2 lg:gap-24">
          <Reveal>
            <span className="eyebrow">Our mission</span>
            <h2 className="mt-7 text-title text-navy">
              Engineering India&apos;s transition to sustainable mobility.
            </h2>
            <p className="mt-6 text-ink/55">
              To engineer and execute that transition through uncompromising
              infrastructure deployment — not by promising capacity, but by
              pouring pads, pulling cable and energising connections that hold
              for decades.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <span className="eyebrow">Our vision</span>
            <h2 className="mt-7 text-title text-navy">
              From the first thousand to the next ten thousand.
            </h2>
            <p className="mt-6 text-ink/55">
              To be the singular, trusted execution engine for the world&apos;s
              leading energy and automotive brands in India — carrying the
              discipline that built our first thousand chargers into the ten
              thousand that come next.
            </p>
          </Reveal>
        </div>
      </section>

      <Timeline />

      {/* values */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionHeading
            eyebrow="Core values"
            title="Three commitments"
            accent="we do not trade away."
          />

          <RevealGroup className="mt-16 border-t border-navy/10" stagger={0.1}>
            {values.map((v) => (
              <RevealItem key={v.no}>
                <div className="grid gap-6 border-b border-navy/10 py-12 md:grid-cols-[6rem_1fr_1fr] md:gap-12 md:py-16">
                  <span className="text-sm tabular-nums text-ink/25">{v.no}</span>
                  <h3 className="text-title text-navy">{v.title}</h3>
                  <p className="text-ink/55">{v.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* team */}
      <section className="grain relative overflow-hidden bg-navy-950 py-section text-white">
        <div className="shell grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <Reveal variant="scale">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src="/images/trenching.jpg"
                alt="NAKJM crew executing precision cable trenching"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div>
            <span className="eyebrow eyebrow-light">Our team</span>
            <h2 className="mt-7 text-headline text-white">
              50+ people. Two trades. <span className="text-crimson-400">One command.</span>
            </h2>
            <p className="mt-7 max-w-measure text-white/55">
              Civil and electrical under one roof — not subcontracted labour
              assembled per project. That is what lets a site move from
              earthworks to energisation without waiting on anyone else&apos;s
              crew.
            </p>

            <dl className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                { t: "Engineering command", d: "Commissioning engineers owning quality and safety protocols." },
                { t: "Specialised technical units", d: "In-house electrical teams, fabrication specialists, fitters." },
                { t: "Heavy civil workforce", d: "In-house civil crews for rapid turnaround." },
              ].map((tier) => (
                <div key={tier.t} className="bg-navy-950 p-7">
                  <dt className="text-eyebrow uppercase text-white">{tier.t}</dt>
                  <dd className="mt-3 text-sm text-white/50">{tier.d}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-8 border-l-2 border-crimson pl-6 text-sm text-white/60">
              <strong className="font-medium text-crimson-400">Operational edge:</strong>{" "}
              fully licensed, night-shift capable, ready for on-demand crew expansion.
            </p>
          </div>
        </div>
      </section>

      {/* impact numbers */}
      <section className="bg-white py-section">
        <div className="shell">
          <SectionHeading eyebrow="Our impact" title="Track" accent="record." align="center" />
          <div className="mt-16 grid gap-px border border-navy/10 bg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white px-6 py-12 text-center">
                <div className="text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-none tracking-tight text-navy">
                  <Counter
                    to={stat.value}
                    suffix={stat.suffix ?? ""}
                    format={stat.format === "year" ? "year" : "number"}
                  />
                </div>
                <div className="mt-4 text-sm text-ink/45">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
