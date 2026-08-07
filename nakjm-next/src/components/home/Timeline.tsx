"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { timeline } from "@/lib/data/company";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Vertical journey with a spine that fills as it scrolls. */
export function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 65%", "end 55%"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <section className="bg-mist py-section">
      <div className="shell">
        <SectionHeading
          eyebrow="Our journey"
          title="Twelve years,"
          accent="one site at a time."
          lede="We did not arrive at EV infrastructure — we built our way to it, from foundations and floorplates to the fastest-growing charging networks in the country."
        />

        <div ref={ref} className="relative mt-12 lg:mt-16">
          {/* spine */}
          <div className="absolute bottom-0 left-[7px] top-0 w-px bg-navy/10 md:left-[9.25rem]" />
          <motion.div
            className="absolute left-[7px] top-0 w-px origin-top bg-crimson md:left-[9.25rem]"
            style={{ scaleY, height: "100%" }}
          />

          {timeline.map((entry, i) => (
            <motion.article
              key={entry.year}
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: (i % 3) * 0.05 }}
              className="relative grid grid-cols-1 gap-2 pb-10 pl-10 md:grid-cols-[8rem_1fr] md:gap-12 md:pb-14 md:pl-0"
            >
              <span className="absolute left-0 top-2 h-4 w-4 rounded-full border-[3px] border-crimson bg-white md:left-[8.75rem]" />

              <div className="text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-none tracking-tight text-navy md:text-right">
                {entry.year}
              </div>

              <div>
                <h3 className="text-xl font-medium tracking-tight text-navy">{entry.title}</h3>
                <p className="mt-3 max-w-measure text-ink/55">{entry.body}</p>
                {entry.tag ? (
                  <span className="mt-5 inline-block border border-navy/15 px-4 py-1.5 text-eyebrow uppercase text-crimson">
                    {entry.tag}
                  </span>
                ) : null}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
