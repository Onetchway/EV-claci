"use client";

import { motion, type Variants } from "framer-motion";
import type { ElementType, ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

const variants: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 44 },
    show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
  },
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 1.1, ease: EASE } },
  },
  scale: {
    hidden: { opacity: 0, scale: 1.08 },
    show: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: EASE } },
  },
  left: {
    hidden: { opacity: 0, x: -48 },
    show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
  },
};

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  variant?: keyof typeof variants;
  delay?: number;
  className?: string;
  /** Replay each time it enters view rather than once. */
  repeat?: boolean;
}

export function Reveal({
  children,
  as = "div",
  variant = "up",
  delay = 0,
  className,
  repeat = false,
}: RevealProps) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      data-reveal
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, margin: "0px 0px -12% 0px" }}
      variants={variants[variant]}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}

/** Parent that cascades its direct children in. Pair with <RevealItem>. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  as?: ElementType;
}) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </MotionTag>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  variant?: keyof typeof variants;
}) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag data-reveal-child className={className} variants={variants[variant]}>
      {children}
    </MotionTag>
  );
}
