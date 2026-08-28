import Image from 'next/image';
import Link from 'next/link';
import { Landmark, HardHat, Settings, TrendingUp } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import FranchiseJourney from '@/components/FranchiseJourney';
import FranchiseCalculator from '@/components/FranchiseCalculator';
import StepTimeline from '@/components/StepTimeline';
import FaqAccordion from '@/components/FaqAccordion';
import ContactForm from '@/components/ContactForm';
import { LANDOWNER_MODELS, MANAGE_STEPS, PARTNER_TYPES, INVESTMENT_PLANS, FRANCHISE_FAQ } from '@/lib/franchise';

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

const OVERVIEW_STEPS = [
  { title: 'You Invest', body: 'You invest in the charging infrastructure own the asset.' },
  { title: 'We Build', body: 'We handle site assessment, design, procurement, installation & commissioning.' },
  { title: 'We Operate', body: 'We manage technology, network, customer support, maintenance and operations.' },
  { title: 'You Earn', body: 'You track performance and earn recurring revenue as per agreement.' },
];

export default function FranchisePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <ScrollReveal as="span" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                #BeyondCharging
              </ScrollReveal>
              <ScrollReveal as="h1" delay={0.05} className="mt-5 font-display text-display-lg font-extrabold uppercase leading-[1.02]">
                Own the future
                <br />
                <span className="text-brand-500">of EV charging.</span>
              </ScrollReveal>
              <ScrollReveal as="p" delay={0.1} className="mt-4 text-sm font-semibold text-ink/80">
                We build. We operate. You earn.
              </ScrollReveal>
              <ScrollReveal delay={0.12} as="p" className="mt-3 max-w-md text-muted">
                Invest in EV charging infrastructure with Livanto Green and build a future-ready, long-term and sustainable business.
              </ScrollReveal>
              <ScrollReveal delay={0.16} className="mt-8 flex flex-wrap gap-3">
                <Link href="#calculator" className="btn btn-primary">
                  Calculate Your Returns →
                </Link>
                <Link href="/contact" className="btn btn-outline">
                  Talk to an Expert →
                </Link>
              </ScrollReveal>

              <ScrollReveal delay={0.2} className="mt-10 grid grid-cols-4 gap-4 border-t border-line pt-6">
                {[
                  ['Invest', 'You invest in the infrastructure'],
                  ['Build', 'We design, build & commission'],
                  ['Operate', 'We manage technology & operations'],
                  ['Earn', 'You earn from charging revenue'],
                ].map(([t, b]) => (
                  <div key={t}>
                    <div className="text-xs font-bold uppercase text-brand-600">{t}</div>
                    <div className="mt-1 text-[11px] text-muted">{b}</div>
                  </div>
                ))}
              </ScrollReveal>
            </div>

            <ScrollReveal delay={0.1} className="relative overflow-hidden rounded-3xl">
              <Image
                src="/brand/station-dehradun.jpg"
                alt="Livanto Green franchise station"
                width={760}
                height={650}
                priority
                className="h-[300px] w-full object-cover sm:h-[380px]"
              />
              <div className="absolute right-4 top-4 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-left">
                  {[
                    ['AC + DC', 'Charger Portfolio'],
                    ['20–35%', 'Revenue Share'],
                    ['2–3.5 Yrs', 'Typical Payback'],
                    ['24×7', 'Network Operations'],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <div className="font-display text-sm font-bold">{v}</div>
                      <div className="text-[10px] text-muted">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className="bg-surface-alt py-24">
        <div className="container-lv">
          <FranchiseCalculator />
        </div>
      </section>

      {/* 4-step overview */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal className="text-center">
            <span className="eyebrow">Our Partnership Journey</span>
            <h2 className="mt-3 font-display text-display-sm font-extrabold uppercase">
              One investment. <span className="text-brand-500">Complete support.</span>
            </h2>
          </ScrollReveal>
          <div className="mt-16">
            <StepTimeline steps={OVERVIEW_STEPS} />
          </div>
        </div>
      </section>

      {/* We manage everything */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-extrabold uppercase">
              From land to live station. <span className="text-brand-500">We manage everything.</span>
            </h2>
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {MANAGE_STEPS.map((s, i) => (
              <ScrollReveal key={s} delay={(i % 8) * 0.04} className="rounded-2xl border border-line bg-white p-4 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-600">
                  {i + 1}
                </div>
                <div className="mt-2 text-[11px] font-semibold leading-tight">{s}</div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who can partner + investment plans */}
      <section className="bg-white py-24">
        <div className="container-lv grid gap-14 lg:grid-cols-2">
          <div>
            <ScrollReveal as="h3" className="text-xs font-bold uppercase tracking-wide text-muted">
              Who can partner with us?
            </ScrollReveal>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {PARTNER_TYPES.map((p, i) => (
                <ScrollReveal key={p.title} delay={i * 0.05}>
                  <div className="text-sm font-bold">{p.title}</div>
                  <div className="mt-1 text-xs text-muted">{p.body}</div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          <div>
            <ScrollReveal as="h3" className="text-xs font-bold uppercase tracking-wide text-muted">
              Investment plans
            </ScrollReveal>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {INVESTMENT_PLANS.map((p, i) => (
                <ScrollReveal key={p.title} delay={i * 0.07} className="rounded-2xl border border-line bg-surface-alt p-5">
                  <h4 className="text-sm font-bold text-brand-600">{p.title}</h4>
                  <p className="mt-1 text-[11px] text-muted">{p.tag}</p>
                  <p className="mt-1 text-xs font-semibold text-ink/70">{p.kwRange}</p>
                  <ul className="mt-3 space-y-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-muted">✓ {f}</li>
                    ))}
                  </ul>
                  <Link href="/contact" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Know More →
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Journey (detailed, real 7-step) */}
      <section className="mode-dark py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The partnership, in detail.
          </ScrollReveal>
          <div className="mt-14">
            <FranchiseJourney />
          </div>
        </div>
      </section>

      {/* Core models: CoCo / PoCo */}
      <section className="bg-white py-24">
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
      <section className="bg-surface-alt py-24">
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
      <section className="bg-white py-24">
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

      {/* Lead form + FAQ */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <ScrollReveal>
            <span className="eyebrow">Become a Livanto Green partner</span>
            <h3 className="mt-2 font-display text-xl font-bold">Let&apos;s build the future of EV charging together.</h3>
            <div className="mt-6">
              <ContactForm />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <span className="eyebrow">Frequently asked questions</span>
            <div className="mt-4">
              <FaqAccordion items={FRANCHISE_FAQ} />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">The road ahead is electric.</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="#calculator" className="btn bg-white text-brand-800 hover:bg-white/90">
              Calculate Returns →
            </Link>
            <Link href="/contact" className="btn btn-outline">
              Talk to an Expert →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
