"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface SplitTextProps {
  text: string;
  className?: string;
  /** Delay before the first word lifts, in seconds. */
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

/**
 * Masked per-word rise. Each word sits in an overflow-hidden span and is
 * translated up from below, which reads far cleaner than fading whole lines.
 */
export function SplitText({ text, className, delay = 0, as = "h2" }: SplitTextProps) {
  const reduced = useReducedMotion();
  const Tag = as;
  const words = text.split(" ");

  if (reduced) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={cn("inline", className)} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
          style={{ paddingBottom: "0.08em", marginBottom: "-0.08em" }}
        >
          <motion.span
            className="inline-block"
            initial={{ y: "115%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.055 }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
