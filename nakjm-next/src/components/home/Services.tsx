import Link from "next/link";
import { services } from "@/lib/data/services";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";

/**
 * Editorial index rather than a card grid — a numbered list whose rows open
 * up on hover. No boxes, no icons.
 */
export function Services() {
  return (
    <section className="bg-white py-section">
      <div className="shell">
        <SectionHeading
          eyebrow="What we do"
          title="Six disciplines."
          accent="One contract."
          lede="Civil, electrical and EV under one accountable team — so nothing crosses a vendor boundary and nothing falls between contracts."
        />

        <RevealGroup className="mt-16 lg:mt-24" stagger={0.07}>
          {services.map((service) => (
            <RevealItem key={service.slug}>
              <Link
                href={`/services/${service.slug}/`}
                className="group grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-t border-navy/10 py-8 transition-colors duration-500 last:border-b hover:border-navy/30 md:grid-cols-[6rem_1fr_auto] md:gap-x-10 md:py-11"
              >
                <span className="text-sm font-medium tabular-nums text-ink/25 transition-colors duration-500 group-hover:text-crimson">
                  {service.index}
                </span>

                <div>
                  <h3 className="text-[clamp(1.5rem,3.4vw,2.75rem)] font-medium leading-tight tracking-tight text-navy transition-transform duration-700 ease-editorial md:group-hover:translate-x-3">
                    {service.title}
                  </h3>
                  <p className="mt-3 max-w-measure text-ink/50 md:mt-4 md:max-h-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-700 md:ease-editorial md:group-hover:max-h-24 md:group-hover:opacity-100">
                    {service.summary}
                  </p>
                </div>

                <span
                  aria-hidden
                  className="col-start-2 mt-4 text-eyebrow uppercase text-crimson opacity-0 transition-opacity duration-500 md:col-start-3 md:mt-0 md:self-center md:group-hover:opacity-100"
                >
                  Explore →
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
