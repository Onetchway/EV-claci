'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

/**
 * Pill-shaped segmented control with a sliding highlight — used for the
 * product power selector and category tabs. `options` is [{ value, label }].
 */
export default function Toggle({ options, value, onChange, layoutId, className }) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface-alt p-1',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'relative rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300',
              active ? 'text-white' : 'text-ink/60 hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-brand-500"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
