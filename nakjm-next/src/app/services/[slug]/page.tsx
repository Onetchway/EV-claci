import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { services, getService } from "@/lib/data/services";
import { buildMetadata } from "@/lib/seo";
import { serviceSchema, breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { CtaBanner } from "@/components/home/CtaBanner";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return buildMetadata({ title: "Service", description: "", noIndex: true });

  return buildMetadata({
    title: service.title,
    description: service.summary,
    path: `/services/${service.slug}/`,
    image: service.hero,
  });
}

export default async function ServiceDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const others = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <>
      <JsonLd
        data={[
          serviceSchema(service),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services/" },
            { name: service.title, path: `/services/${service.slug}/` },
          ]),
        ]}
      />

      <PageHero
        eyebrow={`Service ${service.index}`}
        title={service.title}
        image={service.hero}
        imageAlt={service.title}
        lede={service.summary}
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Services", href: "/services/" },
          { name: service.title, href: `/services/${service.slug}/` },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          <Reveal>
            <span className="eyebrow">The discipline</span>
            <p className="mt-8 text-[clamp(1.3rem,2.2vw,1.75rem)] font-light leading-[1.45] tracking-tight text-navy">
              {service.intro}
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <span className="eyebrow">What that includes</span>
            <ul className="mt-8">
              {service.capabilities.map((cap) => (
                <li
                  key={cap}
                  className="border-b border-navy/10 py-5 text-ink/65 first:border-t"
                >
                  {cap}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist py-section">
        <div className="shell">
          <span className="eyebrow">Why it holds</span>
          <RevealGroup className="mt-12 grid gap-px border border-navy/10 bg-navy/10 md:grid-cols-3" stagger={0.09}>
            {service.deliverables.map((d) => (
              <RevealItem key={d.title} className="bg-mist p-9 lg:p-12">
                <h2 className="text-xl font-medium tracking-tight text-navy">{d.title}</h2>
                <p className="mt-4 text-ink/55">{d.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="bg-white py-section">
        <div className="shell">
          <span className="eyebrow">Continue</span>
          <div className="mt-10 grid gap-px border border-navy/10 bg-navy/10 md:grid-cols-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/services/${other.slug}/`}
                className="group relative block overflow-hidden bg-white"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={other.hero}
                    alt={other.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[1.2s] ease-editorial group-hover:scale-105"
                  />
                </div>
                <div className="p-8">
                  <span className="text-sm tabular-nums text-ink/25">{other.index}</span>
                  <h3 className="mt-2 text-xl font-medium tracking-tight text-navy">
                    {other.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
