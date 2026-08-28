'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';

const EASE = [0.16, 0.84, 0.44, 1];

/**
 * Electra-app-style scroll-driven phone: a sticky phone mockup whose
 * screen swaps as the user scrolls past each step. `steps` is
 * [{ tag, title, body, screen: ReactNode }].
 */
export default function PhoneShowcase({ steps }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(steps.length - 1, Math.floor(v * steps.length));
    setActive(idx);
  });

  return (
    <div ref={ref} style={{ height: `${steps.length * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="container-lv grid w-full items-center gap-12 lg:grid-cols-2">
          {/* Step copy */}
          <div className="order-2 lg:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <span className="font-display text-sm font-bold text-lime">
                  {String(active + 1).padStart(2, '0')} — {steps[active].tag}
                </span>
                <h3 className="mt-4 font-display text-display-sm font-bold">{steps[active].title}</h3>
                <p className="mt-4 max-w-sm text-white/65">{steps[active].body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex gap-2">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                    i === active ? 'bg-lime' : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Phone */}
          <div className="order-1 flex justify-center lg:order-2">
            <div className="relative h-[560px] w-[280px] rounded-[42px] border border-white/10 bg-ink-soft p-3 shadow-2xl">
              <div className="absolute left-1/2 top-3 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-black" />
              <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-gradient-to-b from-surface-dark to-ink">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="absolute inset-0"
                  >
                    {steps[active].screen}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
