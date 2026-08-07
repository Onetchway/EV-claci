import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { projects, getProject } from "@/lib/data/projects";
import { buildMetadata } from "@/lib/seo";
import { projectSchema, breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { ImageReveal } from "@/components/ui/ImageReveal";
import { CtaBanner } from "@/components/home/CtaBanner";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return buildMetadata({ title: "Project", description: "", noIndex: true });

  return buildMetadata({
    title: project.title,
    description: project.summary,
    path: `/projects/${project.slug}/`,
    image: project.hero,
  });
}

export default async function ProjectDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(index + 1) % projects.length]!;

  return (
    <>
      <JsonLd
        data={[
          projectSchema(project),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Projects", path: "/projects/" },
            { name: project.title, path: `/projects/${project.slug}/` },
          ]),
        ]}
      />

      <PageHero
        eyebrow={project.category}
        title={project.title}
        image={project.hero}
        imageAlt={project.title}
        lede={project.summary}
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Projects", href: "/projects/" },
          { name: project.client, href: `/projects/${project.slug}/` },
        ]}
      />

      {/* fact rail */}
      <section className="border-b border-navy/10 bg-white">
        <div className="shell grid gap-px bg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Client", value: project.client },
            { label: "Location", value: project.location },
            { label: "Completion", value: project.completion },
            { label: "Value", value: project.value ?? "On application" },
          ].map((f) => (
            <div key={f.label} className="bg-white px-2 py-9">
              <dt className="text-eyebrow uppercase text-ink/35">{f.label}</dt>
              <dd className="mt-3 text-lg font-medium tracking-tight text-navy">{f.value}</dd>
            </div>
          ))}
        </div>
      </section>

      {/* overview + scope */}
      <section className="bg-white py-section">
        <div className="shell grid gap-16 lg:grid-cols-[1.15fr_1fr] lg:gap-24">
          <Reveal>
            <span className="eyebrow">Overview</span>
            <div className="mt-8 space-y-6">
              {project.overview.map((para, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "text-[clamp(1.25rem,2vw,1.6rem)] font-light leading-[1.5] tracking-tight text-navy"
                      : "text-ink/55"
                  }
                >
                  {para}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <span className="eyebrow">Scope of works</span>
            <ul className="mt-8">
              {project.scope.map((s) => (
                <li key={s} className="border-b border-navy/10 py-5 text-ink/65 first:border-t">
                  {s}
                </li>
              ))}
            </ul>

            <dl className="mt-12 grid grid-cols-2 gap-px bg-navy/10">
              {project.metrics.map((m) => (
                <div key={m.label} className="bg-white p-6">
                  <dt className="text-eyebrow uppercase text-ink/35">{m.label}</dt>
                  <dd className="mt-2 text-xl font-medium tracking-tight text-navy">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* gallery */}
      {project.gallery.length ? (
        <section className="bg-mist py-section">
          <div className="shell">
            <span className="eyebrow">Gallery</span>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {project.gallery.map((shot, i) => (
                <ImageReveal
                  key={shot.src + i}
                  src={shot.src}
                  alt={shot.alt}
                  className={i === 0 ? "aspect-[16/10] md:col-span-2" : "aspect-[4/3]"}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* next project */}
      <section className="bg-white py-section">
        <div className="shell">
          <span className="eyebrow">Next project</span>
          <Link href={`/projects/${next.slug}/`} className="group mt-8 block">
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-navy-950">
              <Image
                src={next.hero}
                alt={next.title}
                fill
                sizes="100vw"
                className="object-cover transition-transform duration-[1.3s] ease-editorial group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,10,28,0.9)_0%,rgba(0,10,28,0.3)_60%)]" />
              <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
                <span className="text-eyebrow uppercase text-crimson-400">{next.category}</span>
                <h2 className="mt-3 max-w-[24ch] text-title text-white">{next.title}</h2>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
