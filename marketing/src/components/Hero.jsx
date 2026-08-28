'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';

const EASE = [0.16, 0.84, 0.44, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};
const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const opacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section ref={ref} className="relative mode-dark h-[112vh] overflow-hidden">
      <motion.div style={{ scale, opacity }} className="absolute inset-0">
        <EnergyField />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
      </motion.div>

      <motion.div
        style={{ opacity, y: textY }}
        className="sticky top-0 flex h-screen flex-col justify-end pb-24 md:pb-28"
      >
        <motion.div variants={container} initial="hidden" animate="show" className="container-lv">
          <motion.span variants={rise} className="eyebrow">
            Keeping India charged
          </motion.span>

          <motion.h1 variants={rise} className="mt-5 max-w-5xl font-display text-display-xl font-bold">
            Charging the
            <br />
            way forward.
          </motion.h1>

          <motion.p variants={rise} className="mt-7 max-w-xl text-lead text-white/70">
            Home to highway — charging built for how India actually drives.
            Intelligent EV infrastructure connecting people, places and the
            future of mobility.
          </motion.p>

          <motion.div variants={rise} className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/solutions" className="btn btn-primary">
              Explore solutions →
            </Link>
            <Link href="/network" className="btn btn-outline">
              Explore network →
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/**
 * Abstract charge/energy composition — deliberately not a fabricated
 * product photo. Swap for real Livanto product photography/renders
 * once supplied (see design-system audit note on imagery).
 */
function EnergyField() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_78%_-8%,rgba(18,183,106,.5),transparent_60%),radial-gradient(760px_620px_at_8%_115%,rgba(198,249,78,.16),transparent_55%),linear-gradient(160deg,#06231a_0%,#07150F_55%,#03110c_100%)]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-70"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="pulse" x1="0" y1="0" x2="1440" y2="900" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C6F94E" />
            <stop offset="1" stopColor="#12B76A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M120 640 L520 640 L620 420 L720 780 L820 260 L920 640 L1360 640"
          stroke="url(#pulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.4, ease: EASE, delay: 0.6 }}
        />
      </svg>
    </div>
  );
}
