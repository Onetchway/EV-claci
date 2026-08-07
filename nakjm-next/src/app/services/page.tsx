import Link from "next/link";
import Image from "next/image";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { services } from "@/lib/data/services";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { CtaBanner } from "@/components/home/CtaBanner";

export const metadata = buildMetadata({
  title: "Services",
  description:
    "Civil engineering, electrical EPC, EV charging infrastructure, renewables, industrial construction and consultancy — six disciplines delivered under one contract.",
  path: "/services/",
  image: "/images/transformer.jpg",
});

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services/" },
        ])}
      />

      <PageHero
        eyebrow="Services"
        title="Six disciplines."
        accent="One contract."
        lede="Every discipline sits inside the same team, so a site moves from feasibility to energisation without crossing a single vendor boundary."
        image="/images/transformer.jpg"
        imageAlt="High-capacity transformer commissioned by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Services", href: "/services/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          <RevealGroup stagger={0.08}>
            {services.map((service, i) => (
              <RevealItem key={service.slug}>
                <Link
                  href={`/services/${service.slug}/`}
                  className="group grid items-center gap-8 border-t border-navy/10 py-12 last:border-b lg:grid-cols-[6rem_1fr_20rem] lg:gap-12 lg:py-16"
                >
                  <span className="text-sm font-medium tabular-nums text-ink/25 transition-colors duration-500 group-hover:text-crimson">
                    {service.index}
                  </span>

                  <div>
                    <h2 className="text-[clamp(1.75rem,3.6vw,3rem)] font-medium leading-tight tracking-tight text-navy transition-transform duration-700 ease-editorial lg:group-hover:translate-x-3">
                      {service.title}
                    </h2>
                    <p className="mt-4 max-w-measure text-ink/55">{service.summary}</p>
                    <span className="link-sweep mt-7 inline-flex text-crimson">Explore service</span>
                  </div>

                  <div className="relative aspect-[16/10] overflow-hidden lg:aspect-[4/3]">
                    <Image
                      src={service.hero}
                      alt={service.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 20rem"
                      loading={i < 2 ? "eager" : "lazy"}
                      className="object-cover transition-transform duration-[1.2s] ease-editorial group-hover:scale-105"
                    />
                    <span className="absolute inset-0 bg-navy-950/20 transition-opacity duration-500 group-hover:opacity-0" />
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
