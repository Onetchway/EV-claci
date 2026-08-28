import Link from 'next/link';
import Hero from '@/components/Hero';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import ConnectivityFlow from '@/components/ConnectivityFlow';
import StatCounter from '@/components/StatCounter';
import { PRODUCTS } from '@/lib/products';

const SOLUTIONS = [
  { title: 'Home', body: 'Charge where you live.', href: '/solutions' },
  { title: 'Workplace', body: 'Charge while you work.', href: '/solutions' },
  { title: 'Fleet', body: 'Keep your fleet moving.', href: '/solutions' },
  { title: 'Commercial', body: 'Turn parking into charging.', href: '/solutions' },
  { title: 'Public', body: 'Charge wherever the journey takes you.', href: '/solutions' },
  { title: 'Highway', body: 'Fast charging for long-distance mobility.', href: '/solutions' },
];

const FEATURED_PRODUCTS = PRODUCTS.filter((p) => p.featured);

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Ecosystem */}
      <section className="mode-dark py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-3xl font-display text-display-lg font-semibold">
            One ecosystem. Every charging need.
          </ScrollReveal>
          <ScrollReveal delay={0.08} as="p" className="mt-6 max-w-xl text-lead text-white/60">
            Hardware, software, app, network and fleet tools — designed as one
            system, not stitched together from vendors.
          </ScrollReveal>
          <div className="mt-20">
            <ConnectivityFlow />
          </div>
        </div>
      </section>

      {/* Solutions preview */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <ScrollReveal as="h2" className="max-w-xl font-display text-display-md font-semibold">
              Charging for every journey.
            </ScrollReveal>
            <ScrollReveal delay={0.05}>
              <Link href="/solutions" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                All solutions →
              </Link>
            </ScrollReveal>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((s, i) => (
              <ScrollReveal key={s.title} delay={(i % 3) * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line bg-white">
                  <Link href={s.href} className="block h-full p-8">
                    <h3 className="font-display text-xl font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted">{s.body}</p>
                    <span className="mt-6 inline-block text-sm font-semibold text-brand-600">Explore →</span>
                  </Link>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Products preview */}
      <section className="mode-dark py-28">
        <div className="container-lv">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <ScrollReveal as="h2" className="max-w-xl font-display text-display-md font-semibold">
              Hardware built for the real world.
            </ScrollReveal>
            <ScrollReveal delay={0.05}>
              <Link href="/products" className="text-sm font-semibold text-lime hover:text-white">
                All products →
              </Link>
            </ScrollReveal>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {FEATURED_PRODUCTS.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line-dark bg-white/[0.03]">
                  <Link href="/products" className="block h-full p-8">
                    <span className="eyebrow">{p.category === 'AC' ? 'AC' : 'DC fast'}</span>
                    <h3 className="mt-3 font-display text-2xl font-bold">{p.name}</h3>
                    <p className="mt-2 text-white/60">{p.tagline}</p>
                    <div className="mt-6 font-display text-3xl font-bold text-lime">{p.powerLabel}</div>
                  </Link>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Technology teaser */}
      <section className="mode-light py-28">
        <div className="container-lv grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Technology</span>
            <h2 className="mt-4 font-display text-display-md font-semibold">Charging is more than hardware.</h2>
            <p className="mt-5 max-w-md text-muted">
              Find, reserve, start with an OTP, monitor live, pay by UPI or
              wallet — the Livanto app makes charging a five-tap experience.
            </p>
            <Link href="/technology" className="btn btn-primary mt-8">
              See the app →
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="flex h-72 items-center justify-center rounded-3xl border border-line bg-surface-alt">
            <div className="relative h-56 w-32 rounded-[26px] border border-line bg-ink shadow-xl">
              <div className="absolute left-1/2 top-2 h-3 w-14 -translate-x-1/2 rounded-full bg-black/60" />
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-white">
                <span className="font-display text-2xl font-bold text-lime">66%</span>
                <span className="text-[10px] text-white/50">Live session</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Network stats */}
      <section className="mode-brand py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-xl font-display text-display-sm font-semibold">
            A network built for movement.
          </ScrollReveal>
          <div className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4">
            <ScrollReveal>
              <StatCounter value={95} suffix="%+" className="font-display text-4xl font-bold" />
              <div className="mt-1 text-sm text-white/70">Network uptime</div>
            </ScrollReveal>
            {['Charging points', 'Cities', 'States'].map((label) => (
              <ScrollReveal key={label}>
                <div className="font-display text-4xl font-bold">Growing</div>
                <div className="mt-1 text-sm text-white/70">{label}</div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={0.1} className="mt-8">
            <Link href="/network" className="text-sm font-semibold text-white underline underline-offset-4 hover:no-underline">
              Explore the network →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Franchise teaser */}
      <section className="mode-light py-28">
        <div className="container-lv grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Franchise</span>
            <h2 className="mt-4 font-display text-display-md font-semibold">Build the future of mobility.</h2>
            <p className="mt-5 max-w-md text-muted">
              Own the site, Livanto brings the hardware, software and
              operations — a partnership built around your actual numbers.
            </p>
            <Link href="/franchise" className="btn btn-primary mt-8">
              Become a Livanto partner →
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="grid grid-cols-2 gap-4">
            {['Location', 'Infrastructure', 'Technology', 'Operations'].map((s) => (
              <div key={s} className="rounded-2xl border border-line bg-surface-alt p-6 text-center font-display font-semibold">
                {s}
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mode-dark flex min-h-[70vh] items-center py-28">
        <div className="container-lv text-center">
          <ScrollReveal as="h2" className="font-display text-display-lg font-bold">
            The road ahead is electric.
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="mt-10">
            <Link href="/contact" className="btn btn-primary btn-lg">
              Let&apos;s build it together →
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
