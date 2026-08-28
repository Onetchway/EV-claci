'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Zap, Clock, Map as MapIcon, Play } from 'lucide-react';

const EASE = [0.16, 0.84, 0.44, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const STATS = [
  { icon: Zap, value: 'AC + DC', label: 'Charger Portfolio' },
  { icon: Clock, value: '24×7', label: 'Support & Operations' },
  { icon: MapPin, value: 'Noida & Lucknow', label: 'Livanto Offices' },
  { icon: MapIcon, value: 'Pan-India', label: 'Growth Vision' },
];

export default function Hero() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="relative bg-white pb-16 pt-32 sm:pt-36">
      <div className="container-lv">
        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <motion.span variants={rise} className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              #BeyondCharging
            </motion.span>

            <motion.h1 variants={rise} className="mt-5 font-display text-display-lg font-extrabold uppercase leading-[1.02] text-ink">
              Powering
              <br />
              mobility,
              <br />
              <span className="text-brand-500">driving</span>
              <br />
              <span className="text-brand-500">sustainability.</span>
            </motion.h1>

            <motion.p variants={rise} className="mt-6 max-w-md text-muted">
              Intelligent EV charging infrastructure, powerful software and a
              pan-India network built for today, ready for tomorrow.
            </motion.p>

            <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
              <Link href="/solutions" className="btn btn-primary">
                Explore Solutions →
              </Link>
              <Link href="/franchise" className="btn btn-outline">
                Become a Partner →
              </Link>
            </motion.div>
          </div>

          <motion.div
            variants={rise}
            className="relative overflow-hidden rounded-3xl"
          >
            <Image
              src="/brand/hero-charging.jpg"
              alt="Livanto Green EV charging station"
              width={1672}
              height={941}
              priority
              className="h-[280px] w-full object-cover sm:h-[360px] lg:h-[420px]"
            />
            <button
              onClick={() => setPlaying(true)}
              aria-label="Play network film"
              className="group absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur transition-transform duration-300 hover:scale-110"
            >
              <Play className="ml-0.5 h-6 w-6 fill-brand-600 text-brand-600" />
            </button>
            {playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/80 text-center text-sm text-white/70">
                <button onClick={() => setPlaying(false)} className="underline">
                  Film coming soon — close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Stat bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          className="mt-12 grid grid-cols-2 gap-6 rounded-2xl border border-line bg-surface-alt px-6 py-7 sm:grid-cols-4 sm:gap-4"
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold text-ink">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
