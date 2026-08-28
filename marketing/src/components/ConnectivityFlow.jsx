'use client';

import { motion } from 'framer-motion';
import ScrollReveal from './ScrollReveal';

const NODES = ['Vehicle', 'Charger', 'Cloud', 'Livanto CMS', 'App', 'Driver'];

export default function ConnectivityFlow() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="flex flex-col items-stretch gap-0 md:flex-row md:items-center md:justify-between">
        {NODES.map((node, i) => (
          <ScrollReveal key={node} delay={i * 0.08} className="flex flex-1 flex-col items-center md:flex-row">
            <div className="flex flex-col items-center gap-2 py-3 md:py-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] text-lime">
                <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_10px_rgba(198,249,78,.8)]" />
              </div>
              <span className="text-center text-xs font-semibold uppercase tracking-wide text-white/70">{node}</span>
            </div>
            {i < NODES.length - 1 && (
              <div className="mx-2 hidden h-px flex-1 overflow-hidden bg-white/10 md:block">
                <motion.div
                  className="h-full w-1/3 bg-lime"
                  animate={{ x: ['-100%', '400%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', delay: i * 0.25 }}
                />
              </div>
            )}
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
