import { awards } from "@/lib/data/company";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";

export function Awards() {
  return (
    <section className="bg-white py-section">
      <div className="shell">
        <SectionHeading
          eyebrow="Recognition"
          title="Standing"
          accent="appointments."
          lede="Master vendor status is not won on a single job — it is granted after a portfolio's worth of them."
        />

        <RevealGroup className="mt-16 border-t border-navy/10" stagger={0.08}>
          {awards.map((award) => (
            <RevealItem key={`${award.org}-${award.title}`}>
              <div className="group grid grid-cols-[1fr_auto] items-baseline gap-6 border-b border-navy/10 py-7 md:grid-cols-[1fr_1fr_auto] md:py-9">
                <h3 className="text-xl font-medium tracking-tight text-navy md:text-2xl">
                  {award.title}
                </h3>
                <p className="col-span-2 text-ink/50 md:col-span-1 md:text-right">{award.org}</p>
                <span className="text-sm tabular-nums text-ink/30">{award.year}</span>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
