import Image from "next/image";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { news } from "@/lib/data/company";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { CtaBanner } from "@/components/home/CtaBanner";

export const metadata = buildMetadata({
  title: "News",
  description:
    "Project completions, partnerships and milestones from NAKJM Infrastructure — including the 1,000-charger milestone and the Tesla Supercharger site in Gurgaon.",
  path: "/news/",
  image: "/images/hub-vinfast.webp",
});

const fmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function NewsPage() {
  const [lead, ...rest] = news;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "News", path: "/news/" },
        ])}
      />

      <PageHero
        eyebrow="News"
        title="From site,"
        accent="not from a press office."
        lede="Completions, partnerships and milestones — recorded as they happen."
        image="/images/hub-vinfast.webp"
        imageAlt="VinFast OEM delivery hub delivered by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "News", href: "/news/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          {lead ? (
            <article className="group grid items-center gap-10 border-b border-navy/10 pb-16 lg:grid-cols-2 lg:gap-16">
              <div className="relative aspect-[16/10] overflow-hidden bg-navy-950">
                <Image
                  src={lead.image}
                  alt={lead.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-[1.3s] ease-editorial group-hover:scale-105"
                />
              </div>
              <div>
                <div className="flex items-center gap-4 text-eyebrow uppercase">
                  <span className="text-crimson">{lead.category}</span>
                  <span className="text-ink/30">{fmt.format(new Date(lead.date))}</span>
                </div>
                <h2 className="mt-6 max-w-[20ch] text-headline text-navy">{lead.title}</h2>
                <p className="mt-6 max-w-measure text-ink/55">{lead.excerpt}</p>
              </div>
            </article>
          ) : null}

          <RevealGroup className="mt-16 grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
            {rest.map((item) => (
              <RevealItem key={item.slug}>
                <article className="group">
                  <div className="relative aspect-[16/10] overflow-hidden bg-navy-950">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-[1.3s] ease-editorial group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-6 flex items-center gap-4 text-eyebrow uppercase">
                    <span className="text-crimson">{item.category}</span>
                    <span className="text-ink/30">{fmt.format(new Date(item.date))}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-medium leading-snug tracking-tight text-navy">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm text-ink/55">{item.excerpt}</p>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
