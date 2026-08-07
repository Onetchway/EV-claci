"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Crumb {
  name: string;
  href: string;
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  accent?: string;
  lede?: string;
  image: string;
  imageAlt?: string;
  crumbs?: Crumb[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Consistent inner-page opener — full-bleed plate, masked headline, crumbs. */
export function PageHero({
  eyebrow,
  title,
  accent,
  lede,
  image,
  imageAlt = "",
  crumbs,
}: PageHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "24%"]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[62svh] items-end overflow-hidden bg-navy-950 pb-16 pt-40 md:min-h-[70svh] md:pb-24"
    >
      <motion.div className="absolute inset-0" style={reduced ? undefined : { y }}>
        <Image src={image} alt={imageAlt} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,10,28,0.95)_0%,rgba(0,10,28,0.8)_42%,rgba(0,10,28,0.35)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-navy-950 to-transparent" />
      </motion.div>

      <div className="shell relative">
        {crumbs?.length ? (
          <motion.nav
            aria-label="Breadcrumb"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mb-8 flex flex-wrap items-center gap-2 text-xs text-white/60"
          >
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {i === crumbs.length - 1 ? (
                  <span className="text-white/70">{c.name}</span>
                ) : (
                  <Link href={c.href} className="transition-colors hover:text-white">
                    {c.name}
                  </Link>
                )}
              </span>
            ))}
          </motion.nav>
        ) : null}

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.28 }}
          className="eyebrow eyebrow-light"
        >
          {eyebrow}
        </motion.span>

        <h1 className="mt-7 max-w-[18ch] text-headline text-white">
          <span className="block overflow-hidden pb-[0.06em]">
            <motion.span
              className="block"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.38 }}
            >
              {title}
            </motion.span>
          </span>
          {accent ? (
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block text-crimson-400"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.48 }}
              >
                {accent}
              </motion.span>
            </span>
          ) : null}
        </h1>

        {lede ? (
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.68 }}
            className="mt-8 max-w-[52ch] text-lede text-white/75"
          >
            {lede}
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}
