'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, Zap, Battery, Map as MapIcon } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

/** India national outline, projected from Natural Earth 1:110m admin-0 boundary data into a 0 0 300 340 viewBox, centered. */
const INDIA_PATH =
  'M 285.3,109.2 L 286.0,112.7 L 282.7,114.4 L 283.5,120.2 L 276.8,118.5 L 264.8,124.9 L 265.1,130.2 L 259.9,138.1 L 259.5,142.6 L 255.3,150.3 L 248.1,148.1 L 247.7,157.8 L 245.6,160.9 L 246.6,164.9 L 242.0,167.1 L 237.1,152.3 L 234.5,152.4 L 233.0,158.3 L 227.9,153.5 L 230.8,148.2 L 234.9,147.7 L 239.2,139.8 L 233.9,138.2 L 225.2,138.3 L 216.4,137.1 L 215.5,130.6 L 211.1,130.1 L 203.7,126.1 L 200.4,132.4 L 207.2,137.3 L 201.3,140.8 L 199.3,144.2 L 205.0,146.7 L 203.4,152.3 L 206.6,159.3 L 208.1,167.0 L 206.8,170.4 L 200.4,170.2 L 189.0,172.2 L 189.5,179.2 L 184.5,184.7 L 171.1,191.0 L 160.7,201.9 L 153.7,207.8 L 144.4,213.9 L 144.4,218.1 L 131.4,223.8 L 127.1,224.3 L 124.3,231.4 L 126.2,243.5 L 126.7,251.2 L 122.8,260.0 L 122.7,275.8 L 117.9,276.3 L 113.7,283.4 L 116.5,286.5 L 108.0,289.1 L 104.9,295.4 L 101.1,298.1 L 92.3,289.4 L 84.5,267.0 L 81.2,262.6 L 76.2,253.6 L 72.3,236.2 L 63.9,223.4 L 57.2,193.5 L 57.3,182.2 L 55.5,173.5 L 41.9,179.0 L 35.3,177.9 L 23.2,166.7 L 27.7,163.3 L 24.9,159.6 L 14.0,151.7 L 20.2,145.5 L 40.7,145.6 L 38.8,137.6 L 33.6,132.8 L 32.5,125.7 L 26.5,121.5 L 36.7,111.7 L 47.5,112.5 L 57.2,102.7 L 63.1,93.3 L 72.1,83.9 L 72.0,77.3 L 79.9,71.9 L 72.4,67.3 L 65.9,52.8 L 70.4,48.8 L 84.5,51.1 L 94.9,49.7 L 103.9,41.9 L 113.9,52.8 L 113.0,60.4 L 116.7,65.2 L 116.4,69.9 L 109.7,68.7 L 112.3,78.9 L 121.4,84.8 L 134.4,91.3 L 128.5,95.5 L 124.9,104.3 L 133.9,107.8 L 154.8,117.6 L 167.5,118.8 L 172.9,123.5 L 191.3,126.6 L 199.1,126.4 L 200.1,122.7 L 198.9,116.8 L 199.6,112.8 L 205.3,110.8 L 206.3,120.0 L 214.7,123.6 L 220.6,122.1 L 236.0,122.5 L 236.7,116.7 L 232.9,113.8 L 240.4,112.6 L 248.9,105.7 L 259.6,99.8 L 267.4,102.0 L 274.0,98.1 L 278.4,103.9 L 275.3,107.8 L 285.3,109.2 Z';

const PINS = [
  { x: 97.0, y: 106.0, label: 'Delhi NCR', anchor: 'end', dx: -10, dy: 16 },
  { x: 132.9, y: 122.3, label: 'Lucknow', anchor: 'start', dx: 10, dy: 4 },
  { x: 105.7, y: 90.1, label: 'Dehradun', anchor: 'start', dx: 10, dy: -8 },
];

const LIVE_COLOR = '#20A84A';

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
        <ScrollReveal delay={0.1} className="relative mx-auto w-full max-w-sm">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 blur-3xl"
            style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(32,168,74,.16), transparent 70%)' }}
          />
          <svg viewBox="0 0 300 340" className="w-full">
            <defs>
              <linearGradient id="india-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EAF7EE" />
                <stop offset="100%" stopColor="#CFEEDA" />
              </linearGradient>
            </defs>
            <path d={INDIA_PATH} fill="url(#india-fill)" stroke="#7DCB9B" strokeWidth="1.75" strokeLinejoin="round" />
            {PINS.map((p, i) => (
              <g key={p.label}>
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill="none"
                  stroke={LIVE_COLOR}
                  strokeWidth="1.5"
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: i * 0.3 }}
                />
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={5.5}
                  fill={LIVE_COLOR}
                  stroke="#fff"
                  strokeWidth="1.5"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                />
                <text
                  x={p.x + p.dx}
                  y={p.y + p.dy}
                  textAnchor={p.anchor}
                  className="font-display"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fill: '#0F2A4A',
                    paintOrder: 'stroke',
                    stroke: '#EAF7EE',
                    strokeWidth: 3,
                    strokeLinejoin: 'round',
                  }}
                >
                  {p.label}
                </text>
              </g>
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
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
