'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

const LINKS = [
  { href: '/solutions', label: 'Solutions' },
  { href: '/products', label: 'Products' },
  { href: '/technology', label: 'Technology' },
  { href: '/network', label: 'Network' },
  { href: '/franchise', label: 'Franchise' },
  { href: '/about', label: 'About' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
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
          'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-cinematic',
          scrolled ? 'py-3 bg-surface/85 backdrop-blur-md border-b border-line' : 'py-6 bg-transparent'
        )}
      >
        <div className="container-lv flex items-center justify-between">
          <Link
            href="/"
            className={clsx(
              'font-display text-lg font-bold tracking-tight transition-colors',
              scrolled ? 'text-ink' : 'text-white'
            )}
          >
            Livanto <span className="text-brand-500">Green</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-9">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'text-sm font-medium transition-colors',
                  scrolled ? 'text-ink/75 hover:text-brand-600' : 'text-white/85 hover:text-white'
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/network" className={clsx('btn btn-outline', !scrolled && 'border-white/30 text-white hover:border-white/70')}>
              Find a charger
            </Link>
            <Link href="/contact" className="btn btn-primary">
              Contact
            </Link>
          </div>

          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden relative z-10 flex h-9 w-9 flex-col items-center justify-center gap-1.5"
          >
            <span
              className={clsx(
                'block h-[1.5px] w-6 transition-transform duration-300',
                open ? 'translate-y-[3.5px] rotate-45 bg-ink' : scrolled ? 'bg-ink' : 'bg-white'
              )}
            />
            <span
              className={clsx(
                'block h-[1.5px] w-6 transition-transform duration-300',
                open ? '-translate-y-[3.5px] -rotate-45 bg-ink' : scrolled ? 'bg-ink' : 'bg-white'
              )}
            />
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
                  key={l.href}
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
              <Link href="/contact" onClick={() => setOpen(false)} className="btn btn-primary">
                Contact
              </Link>
              <Link href="/network" onClick={() => setOpen(false)} className="btn border border-white/25 text-white">
                Find a charger
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
