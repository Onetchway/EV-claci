import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { sustainabilityPillars } from "@/lib/data/company";
import { CtaBanner } from "@/components/home/CtaBanner";
import { Counter } from "@/components/ui/Counter";

export const metadata = buildMetadata({
  title: "Sustainability",
  description:
    "A thousand chargers is measurable displaced combustion. How NAKJM builds the energy transition — and builds it once, correctly.",
  path: "/sustainability/",
  image: "/images/solar-canopy.jpg",
});

export default function SustainabilityPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Sustainability", path: "/sustainability/" },
        ])}
      />

      <PageHero
        eyebrow="Sustainability"
        title="We do not report"
        accent="the transition. We build it."
        lede="Every charger installed displaces fuel across its whole service life. That is not a pledge — it is infrastructure, in the ground, compounding daily."
        image="/images/solar-canopy.jpg"
        imageAlt="Solar-canopied charging forecourt delivered by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Sustainability", href: "/sustainability/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          <RevealGroup className="grid gap-px border border-navy/10 bg-navy/10 sm:grid-cols-3" stagger={0.09}>
            {[
              { v: 1000, s: "+", l: "Chargers installed and running" },
              { v: 300, s: "+", l: "Sites energised nationwide" },
              { v: 250, s: " kW", l: "Peak per-unit charging delivered" },
            ].map((m) => (
              <RevealItem key={m.l} className="bg-white px-8 py-14 text-center">
                <div className="text-[clamp(2.5rem,5vw,4rem)] font-medium leading-none tracking-tight text-navy">
                  <Counter to={m.v} suffix={m.s} />
                </div>
                <p className="mt-4 text-sm text-ink/45">{m.l}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="bg-mist py-section">
        <div className="shell">
          <SectionHeading
            eyebrow="Our position"
            title="Four things we"
            accent="actually control."
            lede="A contractor cannot credibly claim to decarbonise an economy. It can control what it builds, how well, and how long it lasts."
          />

          <RevealGroup className="mt-16 border-t border-navy/10" stagger={0.09}>
            {sustainabilityPillars.map((p) => (
              <RevealItem key={p.no}>
                <div className="grid gap-6 border-b border-navy/10 py-12 md:grid-cols-[6rem_1fr_1.2fr] md:gap-12 md:py-16">
                  <span className="text-sm tabular-nums text-ink/25">{p.no}</span>
                  <h2 className="text-title text-navy">{p.title}</h2>
                  <p className="text-ink/55">{p.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
