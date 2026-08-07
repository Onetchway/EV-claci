"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/lib/site";

/**
 * Floating on desktop, part of the sticky bottom bar on mobile so it never
 * covers content or the primary CTA.
 */
export function WhatsAppFloat() {
  const [shown, setShown] = useState(false);
  const href = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(site.whatsappMessage)}`;

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* desktop floating pill */}
      <AnimatePresence>
        {shown ? (
          <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with NAKJM on WhatsApp"
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="group fixed bottom-8 right-8 z-40 hidden items-center gap-0 overflow-hidden rounded-full bg-[#25D366] py-4 pl-4 pr-4 text-white shadow-[0_16px_40px_-12px_rgba(37,211,102,0.6)] transition-all duration-500 ease-editorial hover:pr-6 md:flex"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden>
              <path
                fill="currentColor"
                d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35ZM12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Z"
              />
            </svg>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-eyebrow uppercase opacity-0 transition-all duration-500 ease-editorial group-hover:ml-3 group-hover:max-w-[12rem] group-hover:opacity-100">
              Chat with us
            </span>
          </motion.a>
        ) : null}
      </AnimatePresence>

      {/* mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 md:hidden">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 bg-[#25D366] py-4 text-eyebrow uppercase text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              fill="currentColor"
              d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Z"
            />
          </svg>
          WhatsApp
        </a>
        <a
          href={`tel:${site.phoneHref}`}
          className="flex flex-1 items-center justify-center gap-2 bg-crimson py-4 text-eyebrow uppercase text-white"
        >
          Call us
        </a>
      </div>
    </>
  );
}
