"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A short navy curtain lifts on each route change. Keyed on the pathname so
 * it replays per navigation without needing exit choreography.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <motion.div
        key={`curtain-${pathname}`}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[70] origin-top bg-navy-950"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {children}
      </motion.div>
    </>
  );
}
