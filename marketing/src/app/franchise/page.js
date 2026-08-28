import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import FranchiseJourney from '@/components/FranchiseJourney';

export const metadata = {
  title: 'Franchise',
  description: 'Build and operate an EV charging business with Livanto Green — hardware, software, brand and network, backed by 24/7 monitoring and support.',
};

const PROVIDES = [
  { title: 'Hardware', body: 'AC and DC chargers from Livanto’s own line — 7.4 kW to 360 kW.' },
  { title: 'Software', body: 'App, CMS and OCPP management, ready on day one.' },
  { title: 'Brand', body: 'A recognised, growing charging network your site plugs into.' },
  { title: 'Technology', body: 'Remote diagnostics, dynamic load balancing, OTA updates.' },
  { title: 'Operations', body: 'Installation, commissioning and day-to-day running, handled.' },
  { title: 'Support', body: '24/7 monitoring with SLA-backed uptime commitments.' },
];

export default function FranchisePage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Franchise
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            Own the future of mobility.
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-6 max-w-xl text-lead text-white/65">
            Build and operate your EV charging business with Livanto Green —
            we bring the hardware, software and network; you bring the site.
          </ScrollReveal>
          <ScrollReveal delay={0.15} className="mt-9 flex flex-wrap gap-3">
            <Link href="/contact" className="btn btn-primary">
              Become a Livanto partner →
            </Link>
            <Link href="/products" className="btn btn-outline">
              View hardware →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Journey */}
      <section className="mode-dark border-t border-line-dark py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The franchise journey.
          </ScrollReveal>
          <div className="mt-14">
            <FranchiseJourney />
          </div>
        </div>
      </section>

      {/* What Livanto provides */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Livanto provides.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDES.map((p, i) => (
              <ScrollReveal key={p.title} delay={(i % 3) * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line bg-white p-8">
                  <h3 className="font-display text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted">{p.body}</p>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Business model — honest, no invented figures */}
      <section className="mode-alt py-28">
        <div className="container-lv grid gap-12 lg:grid-cols-2">
          <ScrollReveal>
            <span className="eyebrow">Business model</span>
            <h2 className="mt-4 font-display text-display-sm font-semibold">
              A partnership built around real numbers, not promises.
            </h2>
            <p className="mt-5 max-w-md text-muted">
              Investment, revenue share and payback vary by charger mix, site
              type and location — so rather than publish a generic ROI table,
              Livanto’s team builds a proposal against your actual site.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="rounded-3xl border border-line bg-white p-10">
            <h3 className="font-display text-lg font-bold">What we’ll work out together</h3>
            <ul className="mt-5 space-y-3 text-sm text-muted">
              <li className="flex gap-3"><span className="text-brand-600">→</span> Charger mix and total capex for your site</li>
              <li className="flex gap-3"><span className="text-brand-600">→</span> Expected utilisation based on location and traffic</li>
              <li className="flex gap-3"><span className="text-brand-600">→</span> Revenue share and payout structure</li>
              <li className="flex gap-3"><span className="text-brand-600">→</span> Estimated payback timeline</li>
            </ul>
            <Link href="/contact" className="btn btn-primary mt-8">
              Get a custom estimate →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">The road ahead is electric.</h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Let’s build it together →
          </Link>
        </div>
      </section>
    </>
  );
}
