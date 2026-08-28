import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import FranchiseJourney from '@/components/FranchiseJourney';
import FranchiseCalculator from '@/components/FranchiseCalculator';
import { LANDOWNER_MODELS } from '@/lib/franchise';

export const metadata = {
  title: 'Franchise',
  description: 'Build and operate an EV charging business with Livanto Green — 20–35% gross revenue share, typical payback in 2–3.5 years.',
};

const PROVIDES = [
  { title: 'Hardware', body: 'AC and DC chargers from Livanto’s own line — Livanto Home to Livanto DC 240.' },
  { title: 'Software', body: 'App, CMS and OCPP management, ready on day one.' },
  { title: 'Brand', body: 'A recognised, growing charging network your site plugs into.' },
  { title: 'Technology', body: 'Remote diagnostics, dynamic load balancing, OTA updates.' },
  { title: 'Operations', body: 'Turnkey EPC installation, commissioning and 24×7 running.' },
  { title: 'Support', body: 'Ongoing training and quarterly business reviews (QBRs).' },
];

const CORE_MODELS = [
  { title: 'CoCo', full: '(Company-Owned, Company-Operated)', body: 'High standards in flagship locations. Livanto provides full investment & capex. Landowner receives a stable fixed rental or base revenue share.' },
  { title: 'PoCo', full: '(Partner-Owned, Company-Operated)', body: 'Asset owned by franchisee; Livanto operates the technology. Partner provides land + capex, in exchange for 20–35% gross revenue share.' },
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
            we bring the hardware, software and operations; you bring the site.
          </ScrollReveal>
          <ScrollReveal delay={0.15} className="mt-9 flex flex-wrap gap-3">
            <Link href="/contact" className="btn btn-primary">
              Become a Livanto partner →
            </Link>
            <Link href="/products" className="btn btn-outline">
              View hardware →
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={0.2} className="mt-14 grid grid-cols-2 gap-6 border-t border-line-dark pt-10 sm:grid-cols-4">
            {[
              ['20–35%', 'Gross revenue share'],
              ['2–3.5 yrs', 'Payback period'],
              ['70%', 'Bank financing available'],
              ['24×7', 'Livanto-run operations'],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="font-display text-2xl font-bold text-lime">{value}</div>
                <div className="mt-1 text-xs text-white/50">{label}</div>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Calculator */}
      <section className="mode-dark border-t border-line-dark py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Model your investment.
          </ScrollReveal>
          <ScrollReveal delay={0.06} as="p" className="mt-4 max-w-xl text-white/60">
            Six franchise options, from a 60 kW car charger to a 360 kW
            fleet-grade DC station. Drag to see the real numbers.
          </ScrollReveal>
          <div className="mt-12">
            <FranchiseCalculator />
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="mode-dark border-t border-line-dark py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            A partnership, in seven steps.
          </ScrollReveal>
          <div className="mt-14">
            <FranchiseJourney />
          </div>
        </div>
      </section>

      {/* Core models: CoCo / PoCo */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The franchise engine.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {CORE_MODELS.map((m, i) => (
              <ScrollReveal key={m.title} delay={i * 0.08} className="rounded-3xl border border-line bg-white p-9">
                <h3 className="font-display text-2xl font-bold text-brand-600">{m.title}</h3>
                <p className="mt-1 text-sm font-semibold text-muted">{m.full}</p>
                <p className="mt-4 text-sm text-muted">{m.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Landowner models */}
      <section className="mode-alt py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The landowner opportunity.
          </ScrollReveal>
          <ScrollReveal delay={0.06} as="p" className="mt-4 max-w-xl text-muted">
            If you own land, you can monetise it through EV charging — three ways.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {LANDOWNER_MODELS.map((m, i) => (
              <ScrollReveal key={m.title} delay={i * 0.08} className="rounded-2xl border border-line bg-white p-8">
                <h3 className="font-display text-lg font-bold">{m.title}</h3>
                <p className="text-sm font-semibold text-brand-600">{m.subtitle}</p>
                <p className="mt-4 text-sm text-muted">{m.body}</p>
              </ScrollReveal>
            ))}
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
