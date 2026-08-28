'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Toggle from '@/components/Toggle';
import ChargerGlyph from '@/components/ChargerGlyph';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import { PRODUCTS } from '@/lib/products';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'AC', label: 'AC chargers' },
  { value: 'DC', label: 'DC fast chargers' },
];

const EASE = [0.16, 0.84, 0.44, 1];

export default function ProductsClient() {
  const [category, setCategory] = useState('ALL');
  const filtered = useMemo(
    () => (category === 'ALL' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category)),
    [category]
  );
  const [selectedId, setSelectedId] = useState(PRODUCTS[3].id);
  const selected = PRODUCTS.find((p) => p.id === selectedId) ?? filtered[0];

  return (
    <>
      {/* Hero */}
      <section className="mode-dark pt-40 pb-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Products
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            Hardware built to charge the future.
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-6 max-w-xl text-lead text-white/65">
            From everyday AC charging to 360 kW flagship DC — every product
            here ships from Livanto’s own line, not a catalogue of parts.
          </ScrollReveal>
        </div>
      </section>

      {/* Power selector theatre */}
      <section className="mode-dark border-t border-line-dark py-20">
        <div className="container-lv">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Toggle
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              layoutId="category-toggle"
            />
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative h-[380px] rounded-3xl border border-line-dark bg-gradient-to-b from-white/[0.04] to-transparent">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="absolute inset-0"
                >
                  <ChargerGlyph
                    intensity={selected.power / 360}
                    connectors={selected.connector.toLowerCase().includes('dual') ? 2 : 1}
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
                  <span className="text-sm font-semibold uppercase tracking-[0.18em] text-lime">
                    {selected.category === 'AC' ? 'AC charger' : 'DC fast charger'}
                  </span>
                  <h2 className="mt-3 font-display text-display-md font-bold">{selected.name}</h2>
                  <p className="mt-3 text-lead text-white/60">{selected.tagline}</p>
                  <p className="mt-5 max-w-md text-white/70">{selected.description}</p>

                  <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line-dark pt-6">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-white/40">Power</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold text-lime">{selected.powerLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-white/40">Connector</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold">{selected.connector}</dd>
                    </div>
                  </dl>

                  <ul className="mt-6 flex flex-wrap gap-2">
                    {selected.features.map((f) => (
                      <li key={f} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
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
          <div className="mt-16 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={
                    'rounded-2xl border px-5 py-4 text-left transition-all duration-300 ' +
                    (p.id === selected.id
                      ? 'border-lime bg-lime/10'
                      : 'border-white/10 hover:border-white/30')
                  }
                >
                  <div className="font-display text-lg font-bold">{p.powerLabel}</div>
                  <div className="text-xs text-white/50">{p.connector}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Full catalog grid with 3D cards */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            The full lineup.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <ScrollReveal key={p.id} delay={(i % 3) * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line bg-white p-7">
                  <span className="eyebrow">{p.category === 'AC' ? 'AC' : 'DC fast'}</span>
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

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">
            Need help choosing the right charger for your site?
          </h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Talk to us →
          </Link>
        </div>
      </section>
    </>
  );
}
