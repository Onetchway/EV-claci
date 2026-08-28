'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, Zap, Battery, Map as MapIcon } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

/** Approximate, decorative India outline — not for navigational use. */
const INDIA_PATH =
  'M148,4 C160,2 175,8 185,18 C200,15 215,25 210,40 C225,45 235,60 228,75 C245,80 250,100 240,115 C255,125 258,145 245,155 C260,165 255,185 240,190 C250,205 245,225 228,228 C235,245 225,265 210,268 C215,285 200,305 185,300 C180,315 165,330 155,325 C150,338 135,335 130,320 C115,325 105,310 110,295 C95,290 88,275 95,260 C80,250 78,230 90,220 C75,205 80,185 95,180 C85,165 92,145 108,142 C100,125 110,105 128,105 C122,88 132,70 148,68 C140,50 145,30 148,4 Z';

const PINS = [
  { x: 150, y: 88, status: 'live', label: 'Delhi NCR region' },
  { x: 176, y: 112, status: 'live', label: 'Lucknow' },
  { x: 141, y: 72, status: 'live', label: 'Dehradun' },
  { x: 205, y: 150, status: 'upcoming' },
  { x: 130, y: 180, status: 'planned' },
  { x: 165, y: 230, status: 'planned' },
];

const STATUS_COLOR = { live: '#20A84A', upcoming: '#EAB308', planned: '#94A3A8' };

export default function NetworkMapIndia() {
  return (
    <section className="bg-white py-24">
      <div className="container-lv grid gap-14 lg:grid-cols-[280px_1fr_280px] lg:items-center">
        <ScrollReveal>
          <span className="eyebrow">Our Network</span>
          <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
            Built to scale. <span className="text-brand-500">Built across India.</span>
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 text-brand-600"><MapPin className="h-4 w-4" /><span className="text-xs font-semibold uppercase text-muted">Charger Types</span></div>
              <div className="mt-1 font-display text-xl font-bold">AC & DC</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-brand-600"><Zap className="h-4 w-4" /><span className="text-xs font-semibold uppercase text-muted">Network Models</span></div>
              <div className="mt-1 font-display text-xl font-bold">CoCo & PoCo</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-brand-600"><Battery className="h-4 w-4" /><span className="text-xs font-semibold uppercase text-muted">Support</span></div>
              <div className="mt-1 font-display text-xl font-bold">24×7</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-brand-600"><MapIcon className="h-4 w-4" /><span className="text-xs font-semibold uppercase text-muted">Coverage</span></div>
              <div className="mt-1 font-display text-xl font-bold">Pan-India</div>
            </div>
          </div>
        </ScrollReveal>

        {/* Map */}
        <ScrollReveal delay={0.1} className="relative mx-auto w-full max-w-xs">
          <svg viewBox="0 0 300 340" className="w-full">
            <path d={INDIA_PATH} fill="#F0FAF5" stroke="#BEE3D0" strokeWidth="1.5" />
            {PINS.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={p.status === 'live' ? 5 : 4}
                fill={STATUS_COLOR[p.status]}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              >
                {p.status === 'live' && (
                  <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                )}
              </motion.circle>
            ))}
          </svg>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <p className="text-sm text-muted">
            Strategically located charging infrastructure across India&apos;s
            major cities and highways.
          </p>
          <Link href="/franchise" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
            Explore our network →
          </Link>

          <div className="mt-8 rounded-2xl border border-line bg-surface-alt p-5">
            <div className="font-display text-sm font-bold uppercase tracking-wide">Lucknow</div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Region</dt><dd className="font-semibold">Uttar Pradesh</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Charger type</dt><dd className="font-semibold">AC & DC</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="font-semibold text-brand-600">Live</dd></div>
            </dl>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" />Live locations</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" />Upcoming</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Planned</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
