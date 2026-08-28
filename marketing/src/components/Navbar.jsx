'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const LINKS = [
  {
    label: 'Solutions',
    href: '/solutions',
    items: [
      { href: '/solutions#home', label: 'Home charging' },
      { href: '/solutions#fleet', label: 'Fleet charging' },
      { href: '/solutions#commercial', label: 'Destination charging' },
      { href: '/solutions#highway', label: 'Highway charging' },
    ],
  },
  { label: 'Technology', href: '/technology' },
  { label: 'Products', href: '/products' },
  {
    label: 'For Business',
    href: '/franchise',
    items: [
      { href: '/franchise', label: 'Franchise' },
      { href: '/products', label: 'Hardware' },
      { href: '/technology', label: 'Fleet & enterprise' },
    ],
  },
  {
    label: 'About Us',
    href: '/about',
    items: [
      { href: '/about', label: 'About Livanto Green' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

function NavItem({ item }) {
  const [open, setOpen] = useState(false);
  if (!item.items) {
    return (
      <Link href={item.href} className="text-sm font-medium text-ink/75 transition-colors hover:text-brand-600">
        {item.label}
      </Link>
    );
  }
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link href={item.href} className="flex items-center gap-1 text-sm font-medium text-ink/75 transition-colors hover:text-brand-600">
        {item.label}
        <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 top-full z-10 w-56 -translate-x-1/2 pt-3"
          >
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
              {item.items.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="block px-4 py-3 text-sm text-ink/75 transition-colors hover:bg-surface-alt hover:text-brand-600"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }, [open]);

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-shadow duration-300',
          scrolled ? 'border-line shadow-[0_2px_20px_-8px_rgba(0,61,43,0.15)]' : 'border-transparent'
        )}
      >
        <div className="container-lv flex items-center justify-between py-4">
          <Link href="/" className="font-display text-lg font-bold tracking-tight text-ink">
            Livanto <span className="text-brand-500">Green</span>
            <span className="text-brand-500">.</span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <NavItem key={l.label} item={l} />
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/franchise" className="btn btn-primary">
              Partner With Us →
            </Link>
          </div>

          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden relative z-10 flex h-9 w-9 flex-col items-center justify-center gap-1.5"
          >
            <span className={clsx('block h-[1.5px] w-6 bg-ink transition-transform duration-300', open && 'translate-y-[3.5px] rotate-45')} />
            <span className={clsx('block h-[1.5px] w-6 bg-ink transition-transform duration-300', open && '-translate-y-[3.5px] -rotate-45')} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.55, ease: [0.16, 0.84, 0.44, 1] }}
            className="fixed inset-0 z-40 flex flex-col justify-center bg-ink px-8"
          >
            <nav className="flex flex-col gap-2">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.5, ease: [0.16, 0.84, 0.44, 1] }}
                >
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 font-display text-4xl font-semibold text-white/90 hover:text-lime"
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="mt-10 flex gap-3">
              <Link href="/franchise" onClick={() => setOpen(false)} className="btn btn-primary">
                Partner With Us →
              </Link>
              <Link href="/contact" onClick={() => setOpen(false)} className="btn border border-white/25 text-white">
                Contact
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
