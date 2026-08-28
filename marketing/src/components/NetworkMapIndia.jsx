'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, Zap, Battery, Map as MapIcon } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

/** Simplified India national outline, projected from Natural Earth 1:110m admin-0 boundary data into a 0 0 300 340 viewBox. */
const INDIA_PATH =
  'M 279.3,84.3 L 280.0,87.7 L 276.9,89.3 L 277.6,94.8 L 271.3,93.2 L 259.7,99.4 L 260.0,104.4 L 255.1,111.9 L 254.6,116.2 L 250.7,123.6 L 243.7,121.6 L 243.4,130.8 L 241.4,133.8 L 242.3,137.6 L 237.9,139.7 L 233.2,125.6 L 230.8,125.6 L 229.3,131.3 L 224.5,126.7 L 227.2,121.6 L 231.2,121.1 L 235.3,113.6 L 213.4,111.0 L 212.7,104.8 L 208.4,104.3 L 201.4,100.5 L 198.2,106.5 L 204.6,111.2 L 199.1,114.5 L 197.1,117.8 L 202.6,120.2 L 201.1,125.5 L 205.5,139.6 L 204.3,142.8 L 187.2,144.5 L 187.8,151.2 L 183.0,156.5 L 170.2,162.5 L 160.2,172.9 L 144.7,184.4 L 144.7,188.5 L 128.1,194.3 L 125.4,201.1 L 127.7,220.1 L 124.0,228.5 L 123.9,243.6 L 119.3,244.1 L 115.3,250.8 L 118.0,253.8 L 109.9,256.3 L 106.9,262.3 L 103.3,264.9 L 94.9,256.6 L 87.3,235.2 L 79.5,222.4 L 75.8,205.7 L 67.7,193.5 L 61.3,164.9 L 59.6,145.8 L 46.7,151.1 L 40.4,150.0 L 28.8,139.3 L 33.1,136.0 L 30.4,132.5 L 20.0,125.0 L 25.9,119.1 L 45.5,119.1 L 43.7,111.4 L 38.7,106.9 L 37.7,100.1 L 31.9,96.1 L 41.7,86.8 L 52.0,87.4 L 75.6,60.2 L 75.4,53.8 L 83.0,48.7 L 75.8,44.3 L 69.6,30.5 L 73.9,26.6 L 87.4,28.8 L 97.4,27.5 L 105.9,20.0 L 115.5,30.4 L 114.6,37.7 L 118.1,42.2 L 117.9,46.8 L 111.5,45.6 L 114.0,55.4 L 135.1,67.2 L 129.4,71.3 L 126.0,79.6 L 154.6,92.3 L 166.8,93.5 L 171.9,98.0 L 196.9,100.8 L 197.4,87.8 L 202.8,85.9 L 203.8,94.7 L 211.9,98.1 L 217.5,96.7 L 232.2,97.0 L 232.9,91.5 L 229.2,88.7 L 236.4,87.6 L 254.8,75.3 L 262.2,77.5 L 268.6,73.7 L 272.7,79.3 L 269.7,83.0 L 279.3,84.3 Z';

const PINS = [
  { x: 99.4, y: 81.2, status: 'live', label: 'Delhi NCR region' },
  { x: 133.6, y: 96.9, status: 'live', label: 'Lucknow' },
  { x: 107.7, y: 66.0, status: 'live', label: 'Dehradun' },
  { x: 87.7, y: 96.4, status: 'upcoming' },
  { x: 96.5, y: 62.4, status: 'planned' },
  { x: 102.1, y: 128.9, status: 'planned' },
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
