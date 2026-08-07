"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { formatNumber } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CounterProps {
  to: number;
  suffix?: string;
  /** Years should not be comma-grouped. */
  format?: "number" | "year";
  duration?: number;
  className?: string;
}

export function Counter({
  to,
  suffix = "",
  format = "number",
  duration = 1800,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) setValue(to);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(to * eased));
      if (p < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {format === "year" ? String(value) : formatNumber(value)}
      {suffix}
    </span>
  );
}
