'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Zap, Leaf, ShieldCheck, Radar, Rocket, Paintbrush, MonitorSmartphone, Plug, Palette, ClipboardCheck, Wrench, Gauge, HeadphonesIcon, CheckCircle2 } from 'lucide-react';
import Toggle from '@/components/Toggle';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import FaqAccordion from '@/components/FaqAccordion';
import { PRODUCTS } from '@/lib/products';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'AC', label: 'AC chargers' },
  { value: 'DC', label: 'DC fast chargers' },
];

const EASE = [0.16, 0.84, 0.44, 1];

const FEATURES = [
  { icon: Zap, title: 'Ultra-Fast Charging', body: 'Minimised downtime for every EV.' },
  { icon: Leaf, title: 'Smart Energy Management', body: 'Dynamic load balancing and optimised power use.' },
  { icon: ShieldCheck, title: 'Enterprise Grade Reliability', body: 'Built for demanding Indian conditions.' },
  { icon: Radar, title: 'Remote Diagnostics', body: 'Real-time monitoring and issue resolution.' },
  { icon: Rocket, title: 'Future Ready', body: 'Software upgradable & scalable architecture.' },
];

const USE_CASES = [
  { title: 'Public Charging', tag: 'Cities & urban hubs', image: '/brand/station-lucknow.jpg' },
  { title: 'Highway Charging', tag: 'Long-distance travel', image: '/brand/station-dehradun.jpg' },
  { title: 'Fleet Charging', tag: 'Commercial EV fleets', image: null },
  { title: 'Destination Charging', tag: 'Malls, offices, hotels', image: '/brand/hero-charging.jpg' },
];

const CUSTOMIZATIONS = [
  { icon: Paintbrush, title: 'Branding & Wraps', body: 'Custom branding and graphics on the charger body.' },
  { icon: MonitorSmartphone, title: 'Screen Branding', body: 'Display your brand on the charger screen.' },
  { icon: Plug, title: 'Connector Options', body: 'Multiple connector configurations to match your fleet.' },
  { icon: Palette, title: 'Colour Customisation', body: 'Choose colours that represent your brand.' },
];

const SERVICE_STEPS = [
  { icon: ClipboardCheck, title: 'Site Assessment', body: 'Expert evaluation and planning.' },
  { icon: Wrench, title: 'Installation', body: 'Professional and safe installation.' },
  { icon: CheckCircle2, title: 'Commissioning', body: 'Testing and smooth commissioning.' },
  { icon: Gauge, title: 'Monitoring 24×7', body: 'Real-time monitoring and alerts.' },
  { icon: Radar, title: 'Maintenance', body: 'Preventive and corrective maintenance.' },
  { icon: HeadphonesIcon, title: '24×7 Support', body: 'Always available when you need us.' },
];

const FAQ = [
  { q: 'What is the difference between DC 120 and DC 240?', a: 'Livanto DC 120 is a 120 kW car-focused charger for commercial plazas; Livanto DC 240 is fleet-grade, sized for bus and truck applications with more site space (1,000–1,500 sq.ft vs 300–350 sq.ft).' },
  { q: 'How much space is required for installation?', a: 'Car-focused DC chargers (60/120 kW) need roughly 300–350 sq.ft. The 240 kW bus/truck-grade charger needs 1,000–1,500 sq.ft.' },
  { q: 'Which EVs are compatible?', a: 'All Livanto DC chargers use the CCS2 connector standard, compatible with the vast majority of DC-fast-charging-capable EVs sold in India.' },
];

const SPEC_TIERS = PRODUCTS.filter((p) => p.specs);

export default function ProductsClient() {
  const [category, setCategory] = useState('ALL');
  const filtered = useMemo(
    () => (category === 'ALL' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category)),
    [category]
  );
  const [selectedId, setSelectedId] = useState(PRODUCTS[3].id);
  const selected = PRODUCTS.find((p) => p.id === selectedId) ?? filtered[0];
  const [specTierId, setSpecTierId] = useState(SPEC_TIERS[SPEC_TIERS.length - 1].id);
  const specTier = SPEC_TIERS.find((p) => p.id === specTierId);

  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Products
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-3 font-display text-display-lg font-extrabold uppercase leading-tight">
            Hardware built to <span className="text-brand-500">charge the future.</span>
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-4 max-w-xl text-muted">
            From everyday AC charging to fleet-grade 240 kW DC — every
            product here ships from Livanto&apos;s own line, not a catalogue of parts.
          </ScrollReveal>
        </div>
      </section>

      {/* Power selector theatre */}
      <section className="bg-surface-alt py-16">
        <div className="container-lv">
          <Toggle options={CATEGORY_OPTIONS} value={category} onChange={setCategory} layoutId="category-toggle" />

          <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:items-center">
            <div
              className="relative h-[360px] overflow-hidden rounded-3xl shadow-2xl"
              style={{ background: 'radial-gradient(120% 100% at 50% 0%, #0F2A4A 0%, #071A35 55%, #030d1c 100%)' }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'radial-gradient(380px circle at 50% 38%, rgba(111,219,146,.28), transparent 70%)' }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute bottom-10 left-1/2 h-8 w-48 -translate-x-1/2 rounded-full blur-xl"
                style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,.45), transparent)' }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="absolute inset-0 flex items-center justify-center p-8"
                >
                  <Image
                    src={selected.image}
                    alt={selected.name}
                    width={340}
                    height={380}
                    className="h-full w-auto object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]"
                    priority
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <span className="eyebrow">{selected.category === 'AC' ? 'AC charger' : 'DC fast charger'}</span>
                  <h2 className="mt-3 font-display text-display-md font-bold">{selected.name}</h2>
                  <p className="mt-3 text-lead text-muted">{selected.tagline}</p>
                  <p className="mt-5 max-w-md text-muted">{selected.description}</p>

                  <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Power</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold text-brand-600">{selected.powerLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Connector</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold">{selected.connector}</dd>
                    </div>
                  </dl>

                  <ul className="mt-6 flex flex-wrap gap-2">
                    {selected.features.map((f) => (
                      <li key={f} className="rounded-full border border-line px-3 py-1 text-xs text-ink/70">
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/contact" className="btn btn-primary">
                      Get a quote →
                    </Link>
                    <Link href="/technology" className="btn btn-outline">
                      See the software →
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Power rail */}
          <div className="mt-14 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={
                    'rounded-2xl border px-5 py-4 text-left transition-all duration-300 ' +
                    (p.id === selected.id ? 'border-brand-500 bg-brand-500/5' : 'border-line hover:border-brand-500/40')
                  }
                >
                  <div className="font-display text-lg font-bold">{p.name}</div>
                  <div className="text-xs text-muted">{p.powerLabel} · {p.connector}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-md font-display text-display-sm font-extrabold uppercase leading-tight">
            Powering a <span className="text-brand-500">better charging experience.</span>
          </ScrollReveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 0.06} className="rounded-2xl border border-line bg-white p-6">
                <f.icon className="h-6 w-6 text-brand-600" />
                <h3 className="mt-4 text-sm font-bold">{f.title}</h3>
                <p className="mt-1.5 text-xs text-muted">{f.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <ScrollReveal>
              <h2 className="font-display text-display-sm font-extrabold uppercase leading-tight">
                Built for diverse <span className="text-brand-500">use cases.</span>
              </h2>
              <p className="mt-2 text-sm text-muted">One charger. Multiple applications.</p>
            </ScrollReveal>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u, i) => (
              <ScrollReveal key={u.title} delay={i * 0.06} className="group relative h-56 overflow-hidden rounded-2xl">
                {u.image ? (
                  <Image src={u.image} alt={u.title} width={420} height={300} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-800 to-ink" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-sm font-bold">{u.title}</div>
                  <div className="text-xs text-white/70">{u.tag}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Technical specifications (real data) */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-extrabold uppercase leading-tight">Technical Specifications</h2>
            <p className="mt-2 max-w-md text-sm text-muted">Defined for performance, flexibility and long-term reliability.</p>
          </ScrollReveal>

          <ScrollReveal delay={0.08} className="mt-8">
            <div className="flex gap-2">
              {SPEC_TIERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSpecTierId(p.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    specTierId === p.id ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-ink/70 hover:border-brand-500/50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.dl
                key={specTierId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6 grid gap-x-10 gap-y-3 rounded-2xl border border-line bg-surface-alt p-6 sm:grid-cols-2"
              >
                {Object.entries(specTier.specs).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </motion.dl>
            </AnimatePresence>
          </ScrollReveal>
        </div>
      </section>

      {/* Platform teaser */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv grid gap-10 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Connected</span>
            <h2 className="mt-2 font-display text-display-sm font-extrabold uppercase leading-tight">
              Connected to the <span className="text-brand-500">Livanto Green Platform.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted">
              Every charger is connected to our intelligent operating platform
              for real-time monitoring, analytics and a seamless customer experience.
            </p>
            <Link href="/technology" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
              Explore Technology →
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="space-y-3">
            {['Live status monitoring', 'Energy & performance analytics', 'Secure digital payments'].map((f) => (
              <div key={f} className="flex items-center gap-3 rounded-xl border border-line bg-white px-5 py-4 text-sm font-medium">
                <span className="text-brand-600">✓</span> {f}
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Full catalog grid */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The full lineup.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <ScrollReveal key={p.id} delay={(i % 3) * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line bg-white p-7">
                  <div className="flex h-32 items-center justify-center">
                    <Image src={p.image} alt={p.name} width={90} height={128} className="h-full w-auto object-contain" />
                  </div>
                  <span className="eyebrow mt-4 inline-block">{p.category === 'AC' ? 'AC' : 'DC fast'}</span>
                  <h3 className="mt-3 font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-2 text-sm text-muted">{p.tagline}</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-brand-600">{p.powerLabel}</span>
                    <span className="text-sm text-muted">{p.connector}</span>
                  </div>
                  <button
                    onClick={() => {
                      setCategory('ALL');
                      setSelectedId(p.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View details →
                  </button>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Customize + Support */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv grid gap-6 lg:grid-cols-2">
          <ScrollReveal className="rounded-2xl border border-line bg-white p-8">
            <span className="eyebrow">Customize Your Charger</span>
            <h3 className="mt-2 font-display text-lg font-bold">Make it yours.</h3>
            <div className="mt-6 grid grid-cols-2 gap-5">
              {CUSTOMIZATIONS.map((c) => (
                <div key={c.title}>
                  <c.icon className="h-5 w-5 text-brand-600" />
                  <div className="mt-2 text-xs font-bold">{c.title}</div>
                  <p className="mt-1 text-[11px] text-muted">{c.body}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.08} className="rounded-2xl border border-line bg-white p-8">
            <span className="eyebrow">Built for Uptime</span>
            <h3 className="mt-2 font-display text-lg font-bold">Supported at every step.</h3>
            <div className="mt-6 grid grid-cols-2 gap-5">
              {SERVICE_STEPS.map((s) => (
                <div key={s.title}>
                  <s.icon className="h-5 w-5 text-brand-600" />
                  <div className="mt-2 text-xs font-bold">{s.title}</div>
                  <p className="mt-1 text-[11px] text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
        <div className="container-lv mt-10 flex justify-center">
          <Link href="/contact" className="btn btn-primary">
            Talk to Our Experts →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-24">
        <div className="container-lv max-w-2xl">
          <ScrollReveal as="h2" className="font-display text-xl font-bold">
            Frequently Asked Questions
          </ScrollReveal>
          <div className="mt-6">
            <FaqAccordion items={FAQ} />
          </div>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">Ready to deploy the right charger?</h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Request a Quote →
          </Link>
        </div>
      </section>
    </>
  );
}
