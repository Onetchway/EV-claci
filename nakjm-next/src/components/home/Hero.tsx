"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { site, stats } from "@/lib/site";
import { Counter } from "@/components/ui/Counter";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // The plate drifts slower than the page and dims as the copy leaves.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.16]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["0%", "42%"]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  const line1 = "Building Tomorrow,";
  const line2 = "Together.";

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] overflow-hidden bg-navy-950">
      <motion.div
        className="absolute inset-0"
        style={reduced ? undefined : { y, scale }}
      >
        <Image
          src="/images/hero.jpg"
          alt="EV charging infrastructure delivered by NAKJM Infrastructure"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Two scrims: one for the copy column, one to seat the stat rail. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,10,28,0.94)_0%,rgba(0,10,28,0.78)_38%,rgba(0,10,28,0.28)_72%,rgba(0,10,28,0.12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-950 via-navy-950/55 to-transparent" />
      </motion.div>

      <motion.div
        className="shell relative flex h-full flex-col justify-center pb-40 pt-28"
        style={reduced ? undefined : { y: copyY, opacity: copyOpacity }}
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="eyebrow eyebrow-light"
        >
          {site.legalName}
        </motion.span>

        <h1 className="mt-8 max-w-[16ch] text-display text-white">
          {[line1, line2].map((line, li) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className={li === 1 ? "block text-crimson-400" : "block"}
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1.15, ease: EASE, delay: 0.45 + li * 0.11 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease: EASE, delay: 0.85 }}
          className="mt-9 max-w-[46ch] text-lede text-white/65"
        >
          Total EPC solutions for the next generation of national
          infrastructure — civil, electrical and EV charging delivered by one
          accountable team.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease: EASE, delay: 1 }}
          className="mt-12 flex flex-wrap gap-4"
        >
          <Link
            href="/projects"
            className="group relative inline-flex items-center gap-3 overflow-hidden bg-crimson px-9 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:bg-crimson-700"
          >
            <span className="relative z-10">View our work</span>
            <span aria-hidden className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 border border-white/30 px-9 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:border-white hover:bg-white hover:text-navy"
          >
            Commission a project
          </Link>
        </motion.div>
      </motion.div>

      {/* stat rail seated on the hero's foot */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE, delay: 1.15 }}
        className="absolute inset-x-0 bottom-0 z-10 border-t border-white/12 bg-navy-950/50 backdrop-blur-md"
      >
        <div className="shell grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`px-1 py-6 lg:py-8 ${i < stats.length - 1 ? "lg:border-r lg:border-white/10" : ""} ${i % 2 === 0 ? "border-r border-white/10 lg:border-r" : ""}`}
            >
              <div className="text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-none tracking-tight text-white">
                <Counter
                  to={stat.value}
                  suffix={stat.suffix ?? ""}
                  format={stat.format === "year" ? "year" : "number"}
                />
              </div>
              <div className="mt-2 text-xs text-white/45 lg:text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* scroll hint */}
      <div className="pointer-events-none absolute bottom-[8.5rem] left-1/2 hidden -translate-x-1/2 lg:block">
        <span className="relative block h-14 w-px overflow-hidden bg-white/20">
          <span className="absolute inset-x-0 top-0 block h-1/2 animate-scrollHint bg-crimson-400" />
        </span>
      </div>
    </section>
  );
}
