'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FRANCHISE_STEPS } from '@/lib/franchise';

const EASE = [0.16, 0.84, 0.44, 1];

export default function FranchiseJourney() {
  const [active, setActive] = useState(0);
  const STEPS = FRANCHISE_STEPS;
  const step = STEPS[active];

  return (
    <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {STEPS.map((s, i) => (
          <li key={s.n}>
            <button
              onClick={() => setActive(i)}
              className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-left transition-colors duration-300 ${
                i === active ? 'bg-brand-500 text-white' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <span className="font-display text-sm font-bold opacity-70">{s.n}</span>
              <span className="text-sm font-semibold">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="relative min-h-[220px] rounded-3xl border border-line-dark bg-white/[0.03] p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="font-display text-6xl font-bold text-white/10">{step.n}</span>
            <h3 className="mt-2 font-display text-display-sm font-bold">{step.title}</h3>
            <p className="mt-4 max-w-md text-white/65">{step.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Step ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= active ? 'bg-lime' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
