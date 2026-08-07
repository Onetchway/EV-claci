"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { navigation, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close everything on navigation.
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Lock the page behind the mobile sheet.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setOpenGroup(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-swift",
          stuck || mobileOpen
            ? "border-b border-navy/8 bg-white/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="shell flex items-center justify-between gap-8 py-4">
          <Link href="/" aria-label={`${site.name} home`} className="relative z-10 shrink-0">
            <Image
              src="/images/logo.png"
              alt={site.name}
              width={172}
              height={53}
              priority
              className={cn(
                "w-[132px] transition-all duration-500 ease-swift md:w-[158px]",
                !stuck && !mobileOpen && "brightness-0 invert",
              )}
            />
          </Link>

          {/* desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navigation.map((item) => {
              const active = isActive(item.href);
              if (!item.children) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative px-4 py-3 text-eyebrow uppercase transition-colors duration-300",
                      stuck ? "text-navy" : "text-white",
                      active && (stuck ? "text-crimson" : "text-crimson-400"),
                    )}
                  >
                    {item.label}
                    <span
                      className={cn(
                        "absolute inset-x-4 bottom-1.5 h-px origin-left bg-current transition-transform duration-400 ease-editorial",
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                      )}
                    />
                  </Link>
                );
              }

              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setOpenGroup(item.href)}
                  onMouseLeave={() => setOpenGroup(null)}
                >
                  <Link
                    href={item.href}
                    aria-expanded={openGroup === item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2 px-4 py-3 text-eyebrow uppercase transition-colors duration-300",
                      stuck ? "text-navy" : "text-white",
                      active && (stuck ? "text-crimson" : "text-crimson-400"),
                    )}
                  >
                    {item.label}
                    <svg
                      viewBox="0 0 10 6"
                      aria-hidden
                      className={cn(
                        "h-1.5 w-2.5 transition-transform duration-300",
                        openGroup === item.href && "rotate-180",
                      )}
                    >
                      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    <span
                      className={cn(
                        "absolute inset-x-4 bottom-1.5 h-px origin-left bg-current transition-transform duration-400 ease-editorial",
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                      )}
                    />
                  </Link>

                  <AnimatePresence>
                    {openGroup === item.href ? (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-full w-[22rem] border-t-2 border-crimson bg-white p-2 shadow-[0_24px_60px_-24px_rgba(0,19,47,0.35)]"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="group/item block border-l-2 border-transparent px-5 py-4 transition-all duration-300 ease-swift hover:border-crimson hover:bg-mist hover:pl-6"
                          >
                            <span className="block text-sm font-medium text-navy">{child.label}</span>
                            {child.blurb ? (
                              <span className="mt-1 block text-xs text-ink/45">{child.blurb}</span>
                            ) : null}
                          </Link>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="hidden shrink-0 lg:block">
            <Link
              href="/contact"
              className="group relative inline-flex items-center gap-3 overflow-hidden bg-crimson px-7 py-3.5 text-eyebrow uppercase text-white transition-colors duration-300 hover:bg-crimson-700"
            >
              <span className="relative z-10">Commission a project</span>
              <span aria-hidden className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {/* mobile trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className={cn(
              "relative z-10 flex h-11 w-11 items-center justify-center lg:hidden",
              stuck || mobileOpen ? "text-navy" : "text-white",
            )}
          >
            <span className="relative block h-4 w-6">
              <span
                className={cn(
                  "absolute left-0 block h-px w-6 bg-current transition-all duration-300 ease-swift",
                  mobileOpen ? "top-2 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-2 block h-px w-6 bg-current transition-opacity duration-200",
                  mobileOpen && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-px w-6 bg-current transition-all duration-300 ease-swift",
                  mobileOpen ? "top-2 -rotate-45" : "top-4",
                )}
              />
            </span>
          </button>
        </div>
      </header>

      {/* mobile sheet — a dedicated layout, not a squeezed desktop nav */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-white pt-24 lg:hidden"
          >
            <nav className="shell pb-16" aria-label="Mobile">
              {navigation.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-navy/8"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={item.href}
                      className="flex-1 py-6 text-3xl font-medium tracking-tight text-navy"
                    >
                      {item.label}
                    </Link>
                    {item.children ? (
                      <button
                        type="button"
                        aria-expanded={openGroup === item.href}
                        aria-label={`Show ${item.label} links`}
                        onClick={() => setOpenGroup(openGroup === item.href ? null : item.href)}
                        className="grid h-11 w-11 place-items-center text-navy"
                      >
                        <span className="relative block h-3 w-3">
                          <span className="absolute left-0 top-1.5 h-px w-3 bg-current" />
                          <span
                            className={cn(
                              "absolute left-1.5 top-0 h-3 w-px bg-current transition-transform duration-300",
                              openGroup === item.href && "scale-y-0",
                            )}
                          />
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {item.children && openGroup === item.href ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-l border-navy/10 pb-5 pl-5">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block py-3 text-base text-ink/60"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mt-10 space-y-4"
              >
                <Link
                  href="/contact"
                  className="flex w-full items-center justify-center gap-3 bg-crimson px-8 py-5 text-eyebrow uppercase text-white"
                >
                  Commission a project <span aria-hidden>→</span>
                </Link>
                <a
                  href={`tel:${site.phoneHref}`}
                  className="flex w-full items-center justify-center gap-3 border border-navy/20 px-8 py-5 text-eyebrow uppercase text-navy"
                >
                  {site.phone}
                </a>
              </motion.div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
