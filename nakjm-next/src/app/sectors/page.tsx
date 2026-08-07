import Image from "next/image";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { sectors } from "@/lib/data/company";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { CtaBanner } from "@/components/home/CtaBanner";

export const metadata = buildMetadata({
  title: "Sectors",
  description:
    "EV charging, government works for MCD, PWD and BSES, warehousing and industrial, solar, MS fabrication, HT/LT electrical, educational and corporate delivery.",
  path: "/sectors/",
  image: "/images/factory.jpg",
});

export default function SectorsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Sectors", path: "/sectors/" },
        ])}
      />

      <PageHero
        eyebrow="Sectors"
        title="One team,"
        accent="every terrain."
        lede="Government works to private megahubs — the same in-house civil and electrical teams carry their discipline across every sector we serve."
        image="/images/factory.jpg"
        imageAlt="Large-scale steel-frame construction by NAKJM"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Sectors", href: "/sectors/" },
        ]}
      />

      <section className="bg-white py-section">
        <div className="shell">
          <RevealGroup className="grid gap-px bg-navy/10 md:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
            {sectors.map((sector) => (
              <RevealItem key={sector.slug}>
                <article className="group relative flex h-full min-h-[24rem] flex-col justify-end overflow-hidden bg-navy-950 p-8 text-white lg:min-h-[28rem]">
                  <Image
                    src={sector.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-[1.4s] ease-editorial group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,10,28,0.96)_8%,rgba(0,10,28,0.6)_48%,rgba(0,10,28,0.2)_100%)] transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative">
                    <span className="text-eyebrow uppercase text-crimson-400">{sector.kicker}</span>
                    <h2 className="mt-3 text-2xl font-medium tracking-tight text-white">
                      {sector.title}
                    </h2>

                    {/* detail eases open on hover; always open on touch */}
                    <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-700 ease-editorial group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100 [@media(hover:none)]:grid-rows-[1fr] [@media(hover:none)]:opacity-100">
                      <div className="overflow-hidden">
                        <p className="pt-4 text-sm text-white/60">{sector.body}</p>
                        <ul className="mt-4 space-y-1.5">
                          {sector.points.map((p) => (
                            <li key={p} className="flex gap-3 text-sm text-white/50">
                              <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 bg-crimson" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
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
