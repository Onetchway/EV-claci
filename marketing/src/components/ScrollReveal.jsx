'use client';

import { motion } from 'framer-motion';

/**
 * Purposeful, restrained reveal: content settles up + in as it enters
 * view. One easing curve, one duration, used everywhere for rhythm.
 */
export default function ScrollReveal({
  as: Tag = 'div',
  children,
  delay = 0,
  y = 28,
  className,
  once = true,
  amount = 0.3,
}) {
  const MotionTag = motion[Tag] ?? motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.9, delay, ease: [0.16, 0.84, 0.44, 1] }}
    >
      {children}
    </MotionTag>
  );
}
