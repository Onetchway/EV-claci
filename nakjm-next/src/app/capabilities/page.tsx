import Image from "next/image";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { CtaBanner } from "@/components/home/CtaBanner";

export const metadata = buildMetadata({
  title: "Capabilities",
  description:
    "In-house MS fabrication, 50+ civil and electrical crew, 7.4 kW to 250 kW charging deployment, and a Delhi NCR command centre running multi-state rollouts.",
  path: "/capabilities/",
  image: "/images/panel.jpg",
});

const plant = [
  { title: "In-house MS fabrication", body: "Canopies, charger superstructures, custom panels and enclosures built on our schedule — not a supplier's.", image: "/images/panel.jpg" },
  { title: "Heavy civil plant", body: "Excavation, trenching and earthworks equipment with crews licensed to run it through the night.", image: "/images/trenching.jpg" },
  { title: "Electrical test bench", body: "Thermal, insulation and earth-resistance diagnostics carried out before any site is energised.", image: "/images/transformer.jpg" },
];

const ratings = {
  low: ["7.4 kW", "11 kW", "22 kW"],
  high: ["30 kW", "60 kW", "120 kW", "180 kW", "240 kW", "250 kW"],
};

export default function CapabilitiesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Capabilities", path: "/capabilities/" },
        ])}
      />

      <PageHero
        eyebrow="Capabilities"
        title="The plant, the crews,"
        accent="the command centre."
        lede="Capability is not a claim — it is equipment on the yard, licensed people on the payroll and a facility that answers to our own programme."
        image="/images/panel.jpg"
        imageAlt="Custom HT/LT panel engineered and wired by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Capabilities", href: "/capabilities/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          <SectionHeading eyebrow="Plant & facilities" title="What we own," accent="and therefore control." />

          <RevealGroup className="mt-16 grid gap-10 md:grid-cols-3" stagger={0.1}>
            {plant.map((item) => (
              <RevealItem key={item.title}>
                <div className="relative mb-7 aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-medium tracking-tight text-navy">{item.title}</h3>
                <p className="mt-3 text-ink/55">{item.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* charging ratings */}
      <section className="grain bg-navy-950 py-section text-white">
        <div className="shell">
          <SectionHeading
            eyebrow="Charging deployment"
            title="From a home charger"
            accent="to a highway megahub."
            light
          />

          <div className="mt-16 grid gap-14 lg:grid-cols-2">
            <Reveal>
              <h3 className="text-eyebrow uppercase text-white/45">Low-voltage & distributed</h3>
              <div className="mt-6 flex flex-wrap gap-3">
                {ratings.low.map((r) => (
                  <span key={r} className="border border-white/25 px-5 py-2.5 text-sm tabular-nums text-white">
                    {r}
                  </span>
                ))}
              </div>
              <ul className="mt-8 space-y-3 text-white/55">
                {["Dedicated residential charging", "High-density apartment installations", "Luxury villa installations", "Direct OEM installations for MG & VinFast"].map((i) => (
                  <li key={i} className="border-b border-white/10 pb-3">{i}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <h3 className="text-eyebrow uppercase text-crimson-400">High-voltage & hub deployment</h3>
              <div className="mt-6 flex flex-wrap gap-3">
                {ratings.high.map((r) => (
                  <span key={r} className="border border-crimson px-5 py-2.5 text-sm tabular-nums text-crimson-400">
                    {r}
                  </span>
                ))}
              </div>
              <ul className="mt-8 space-y-3 text-white/55">
                {["Ultra-fast highway chargers", "Corridor charging hubs", "Heavy fleet charging depots", "Public commercial infrastructure"].map((i) => (
                  <li key={i} className="border-b border-white/10 pb-3">{i}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* footprint */}
      <section className="bg-white py-section">
        <div className="shell grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <Reveal variant="scale">
            <div className="relative aspect-square w-full border border-navy/10">
              <Image
                src="/images/india-map.jpg"
                alt="Map of India showing NAKJM's Delhi NCR command centre dispatching crews nationwide"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-contain"
              />
            </div>
          </Reveal>

          <div>
            <span className="eyebrow">Operating footprint</span>
            <h2 className="mt-7 text-headline text-navy">
              Command centre: <span className="text-crimson">Delhi NCR.</span>
            </h2>
            <p className="mt-7 max-w-measure text-ink/55">
              Standard 100 km operational radiuses, plus dedicated outstation
              multi-state rollouts. Every programme — government or private — is
              planned, dispatched and supervised from one desk on a hub-and-spoke
              model that keeps supervision close to the work.
            </p>

            <div className="mt-10 grid gap-px border border-navy/10 bg-navy/10 sm:grid-cols-2">
              {[
                { t: "100 km", d: "Standard operational radius" },
                { t: "Multi-state", d: "Dedicated outstation rollouts" },
                { t: "Night-shift", d: "Fully licensed and capable" },
                { t: "On demand", d: "Crew expansion at short notice" },
              ].map((s) => (
                <div key={s.t} className="bg-white p-7">
                  <div className="text-xl font-medium tracking-tight text-navy">{s.t}</div>
                  <div className="mt-2 text-sm text-ink/45">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
