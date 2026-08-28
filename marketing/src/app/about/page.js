import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import StatCounter from '@/components/StatCounter';

export const metadata = {
  title: 'About',
  description: "Livanto Green is building India's largest network of EV charging stations for a sustainable future.",
};

const VALUES = [
  { title: 'Reliability first', body: 'A charger that doesn’t work isn’t infrastructure — every product and every line of software is built around uptime.' },
  { title: 'Vertical ownership', body: 'Hardware, app and CMS built as one system, not stitched together from vendors.' },
  { title: 'Built for India', body: 'Real-world conditions, real electrical infrastructure, real site constraints — designed for how India actually charges.' },
];

const SEGMENTS = [
  { label: 'Fleet', names: 'BLU Smart, Zoomcar, Lithium, Meru, Uber, eBikeGo' },
  { label: 'Automotive', names: 'MG, Hyundai, Ather, Kia, Hero Electric, Tata Motors, BMW, Maruti Suzuki, Mercedes-Benz, Volvo' },
  { label: 'Hospitality', names: 'Savoy Suites, Prestige, Crowne Plaza, ITC Hotels, Sarovar, Ascot, Royal Orchid' },
  { label: 'Commercial', names: 'DLF, GMR, Adani, JLL, Delhi International Airport, Nexus Malls' },
  { label: 'Residential', names: 'Unitech Infra, ORIX, Gaurs, DLF, Alphacorp, Emaar' },
];

const OEM_PARTNERS = ['Kia', 'MG', 'Tata.ev', 'VinFast', 'Mahindra'];
const PRESS = ['The Economic Times', 'The Times of India', 'Delhi Times', 'The Sunday Times of India', 'ANI', 'NDTV', 'India Today', 'Noida Times'];

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
          <ScrollReveal as="p" delay={0.1} className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-lime">
            #BeyondCharging
          </ScrollReveal>
        </div>
      </section>

      {/* Mission */}
      <section className="mode-light py-28">
        <div className="container-lv max-w-3xl">
          <ScrollReveal as="span" className="eyebrow">
            Mission
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.05} className="mt-6 font-display text-display-sm font-semibold leading-tight">
            “Building India’s largest network of EV charging stations for a
            sustainable future.”
          </ScrollReveal>
          <ScrollReveal delay={0.1} as="p" className="mt-6 max-w-xl text-muted">
            Powering mobility. Driving sustainability.
          </ScrollReveal>
        </div>
      </section>

      {/* Market context — real, sourced */}
      <section className="mode-alt py-24">
        <div className="container-lv grid gap-10 md:grid-cols-3">
          <ScrollReveal>
            <StatCounter value={66.52} decimals={2} suffix="%" className="font-display text-4xl font-bold text-brand-600" />
            <div className="mt-2 text-sm text-muted">India EV market CAGR, 2024–2030 (Mordor Intelligence)</div>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <div className="font-display text-4xl font-bold text-brand-600">20M+</div>
            <div className="mt-2 text-sm text-muted">Projected EV sales in India by 2030</div>
          </ScrollReveal>
          <ScrollReveal delay={0.16}>
            <div className="font-display text-4xl font-bold text-brand-600">1.6L+</div>
            <div className="mt-2 text-sm text-muted">4-wheeler EVs already registered in India</div>
          </ScrollReveal>
        </div>
      </section>

      {/* Approach */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Hardware and software, built together.
          </ScrollReveal>
          <ScrollReveal delay={0.08} as="p" className="mt-6 max-w-xl text-muted">
            Livanto designs its own AC and DC chargers — from the 7.4 kW
            Livanto Home to the fleet-grade Livanto DC 240 — alongside the
            app and CMS that run them. That vertical ownership is what makes
            {' >'}95% network uptime a commitment rather than a hope.
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

      {/* Real deployed station photo */}
      <section className="relative py-28">
        <ScrollReveal className="container-lv">
          <div className="relative overflow-hidden rounded-3xl">
            <Image
              src="/brand/hero-charging.jpg"
              alt="Livanto Green EV charger"
              width={1672}
              height={941}
              className="h-[420px] w-full object-cover"
            />
          </div>
        </ScrollReveal>
      </section>

      {/* Who we work with */}
      <section className="mode-alt py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Who we work with.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {SEGMENTS.map((s, i) => (
              <ScrollReveal key={s.label} delay={(i % 5) * 0.06} className="rounded-2xl border border-line bg-white p-6">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand-600">{s.label}</h3>
                <p className="mt-3 text-xs leading-relaxed text-muted">{s.names}</p>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.1} className="mt-14 border-t border-line pt-10">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">OEM &amp; strategic alliances</h3>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {OEM_PARTNERS.map((o) => (
                <span key={o} className="font-display text-lg font-bold text-ink/70">{o}</span>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15} className="mt-10 border-t border-line pt-10">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">In the press</h3>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {PRESS.map((p) => (
                <span key={p} className="text-sm font-semibold text-ink/60">{p}</span>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Leadership */}
      <section className="mode-dark py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Leadership.
          </ScrollReveal>
          <ScrollReveal delay={0.08} className="mt-12 max-w-md rounded-3xl border border-line-dark bg-white/[0.03] p-8">
            <div className="font-display text-2xl font-bold">Ashwani Dixit</div>
            <div className="mt-1 text-sm text-lime">Co-Founder &amp; CEO</div>
            <a href="mailto:ashwanidixit@livantogreen.com" className="mt-4 inline-block text-sm text-white/60 hover:text-white">
              ashwanidixit@livantogreen.com
            </a>
          </ScrollReveal>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="mode-light py-28">
        <div className="container-lv grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Infrastructure</span>
            <h2 className="mt-4 font-display text-display-sm font-semibold">
              A network built to keep growing.
            </h2>
            <p className="mt-5 max-w-md text-muted">
              Livanto is expanding its charging footprint across homes,
              workplaces, commercial sites and highways — with a franchise
              model that lets partners build alongside us.
            </p>
            <Link href="/franchise" className="btn btn-primary mt-8">
              Explore the franchise →
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="rounded-3xl border border-line bg-surface-alt p-10">
            <div className="text-xs uppercase tracking-wide text-muted">Network commitment</div>
            <div className="mt-2 font-display text-5xl font-bold text-brand-600">&gt;95%</div>
            <div className="mt-1 text-sm text-muted">Network uptime</div>
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">
            We’re building the team that builds this network.
          </h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Get in touch →
          </Link>
        </div>
      </section>
    </>
  );
}
