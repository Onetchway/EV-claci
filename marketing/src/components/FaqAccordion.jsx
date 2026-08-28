'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

export default function FaqAccordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((item, i) => (
        <div key={item.q}>
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-ink">{item.q}</span>
            <Plus className={`h-4 w-4 shrink-0 text-brand-600 transition-transform duration-300 ${open === i ? 'rotate-45' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
