"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { testimonials } from "@/lib/data/company";

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const current = testimonials[index]!;

  return (
    <section className="grain bg-navy-950 py-section text-white">
      <div className="shell-wide">
        <span className="eyebrow eyebrow-light">In their words</span>

        <div className="relative mt-12 min-h-[16rem] md:min-h-[14rem]">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="max-w-[22ch] text-[clamp(1.75rem,4vw,3.25rem)] font-light leading-[1.15] tracking-tight text-white md:max-w-[26ch]">
                “{current.quote}”
              </p>
              <footer className="mt-9 text-sm text-white/60">
                <span className="text-white/80">{current.author}</span> — {current.role}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        <div className="mt-12 flex gap-3">
          {testimonials.map((t, i) => (
            <button
              key={t.author + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show testimonial ${i + 1}`}
              aria-current={i === index}
              className="group relative h-8 w-16"
            >
              <span
                className={`absolute inset-x-0 top-1/2 h-px transition-colors duration-400 ${
                  i === index ? "bg-crimson" : "bg-white/25 group-hover:bg-white/60"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
