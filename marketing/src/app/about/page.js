import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';

export const metadata = {
  title: 'About',
  description: "Livanto Green is building India's largest network of EV charging stations for a sustainable future.",
};

const VALUES = [
  { title: 'Reliability first', body: 'A charger that doesn’t work isn’t infrastructure — every product and every line of software is built around uptime.' },
  { title: 'Vertical ownership', body: 'Hardware, app and CMS built as one system, not stitched together from vendors.' },
  { title: 'Built for India', body: 'Real-world conditions, real electrical infrastructure, real site constraints — designed for how India actually charges.' },
];

export default function AboutPage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-32">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            About Livanto Green
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-6 max-w-4xl font-display text-display-lg font-bold">
            We’re building the infrastructure for an electric future.
          </ScrollReveal>
        </div>
      </section>

      {/* Mission — real, quoted from livantogreen.com */}
      <section className="mode-light py-28">
        <div className="container-lv max-w-3xl">
          <ScrollReveal as="span" className="eyebrow">
            Mission
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.05} className="mt-6 font-display text-display-sm font-semibold leading-tight">
            “Building India’s largest network of EV charging stations for a
            sustainable future.”
          </ScrollReveal>
        </div>
      </section>

      {/* Approach */}
      <section className="mode-alt py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Hardware and software, built together.
          </ScrollReveal>
          <ScrollReveal delay={0.08} as="p" className="mt-6 max-w-xl text-muted">
            Livanto designs its own AC and DC chargers — from 7.4 kW everyday
            charging to a 360 kW flagship DC unit — alongside the app and CMS
            that run them. That vertical ownership is what makes {'>'}95%
            network uptime a commitment rather than a hope.
          </ScrollReveal>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {VALUES.map((v, i) => (
              <ScrollReveal key={v.title} delay={0.1 + i * 0.08} className="rounded-2xl border border-line bg-white p-8">
                <h3 className="font-display text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted">{v.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="mode-dark py-28">
        <div className="container-lv grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Infrastructure</span>
            <h2 className="mt-4 font-display text-display-sm font-semibold">
              A network built to keep growing.
            </h2>
            <p className="mt-5 max-w-md text-white/65">
              Livanto is expanding its charging footprint across homes,
              workplaces, commercial sites and highways — with a franchise
              model that lets partners build alongside us.
            </p>
            <Link href="/network" className="btn btn-outline mt-8">
              See the network →
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="rounded-3xl border border-line-dark bg-white/[0.03] p-10">
            <div className="text-xs uppercase tracking-wide text-white/40">Network commitment</div>
            <div className="mt-2 font-display text-5xl font-bold text-lime">&gt;95%</div>
            <div className="mt-1 text-sm text-white/50">Network uptime</div>
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">
            We’re hiring the people who’ll build this network with us.
          </h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Get in touch →
          </Link>
        </div>
      </section>
    </>
  );
}
