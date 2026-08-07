"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGSAP } from "@/hooks/useGSAP";
import { processSteps } from "@/lib/data/company";
import { cn } from "@/lib/utils";

/**
 * The signature sequence: the left column pins while nine stages scroll past
 * on the right, cross-fading the matching plate and advancing the readout.
 * GSAP ScrollTrigger handles both the pin and the active-step detection so
 * they stay on one timeline.
 */
export function PinnedProcess() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    (gsap, ScrollTrigger) => {
      const el = root.current;
      if (!el) return;

      const mm = gsap.matchMedia();

      // Pinning only makes sense where there is a two-column layout to pin.
      mm.add("(min-width: 1024px)", () => {
        const sticky = el.querySelector<HTMLElement>("[data-pin]");
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]", el);
        if (!sticky || !steps.length) return;

        const pin = ScrollTrigger.create({
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
        });

        const triggers = steps.map((step, i) =>
          ScrollTrigger.create({
            trigger: step,
            start: "top 62%",
            end: "bottom 38%",
            onToggle: (self) => {
              if (self.isActive) setActive(i);
            },
          }),
        );

        return () => {
          pin.kill();
          triggers.forEach((t) => t.kill());
        };
      });

      return () => mm.revert();
    },
    [],
  );

  const current = processSteps[active] ?? processSteps[0]!;

  return (
    <section ref={root} className="grain relative bg-navy-950 text-white/60">
      <div className="shell lg:grid lg:grid-cols-2 lg:gap-20">
        {/* pinned plate */}
        <div
          data-pin
          className="hidden lg:flex lg:h-screen lg:flex-col lg:justify-center lg:py-24"
        >
          <span className="eyebrow eyebrow-light">The delivery system</span>
          <h2 className="mt-7 max-w-[14ch] text-headline text-white">
            Follow one site <span className="text-crimson-400">through the system.</span>
          </h2>

          <div className="relative mt-10 aspect-[4/3] w-full overflow-hidden border border-white/10 bg-navy-900">
            {processSteps.map((step, i) => (
              <motion.div
                key={step.no}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.06 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <Image
                  src={step.image}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/75 to-transparent" />
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex items-baseline gap-4">
            <span className="text-5xl font-medium leading-none tracking-tight text-white tabular-nums">
              {current.no}
            </span>
            <span className="text-sm text-white/35">/ 09 stages</span>
          </div>

          <div className="relative mt-5 h-px w-full bg-white/15">
            <motion.span
              className="absolute inset-y-0 left-0 block bg-crimson"
              initial={false}
              animate={{ width: `${((active + 1) / processSteps.length) * 100}%` }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* mobile heading */}
        <div className="pt-section lg:hidden">
          <span className="eyebrow eyebrow-light">The delivery system</span>
          <h2 className="mt-7 text-headline text-white">
            Follow one site <span className="text-crimson-400">through the system.</span>
          </h2>
        </div>

        {/* scrolling steps */}
        <div className="pb-section lg:py-24">
          {processSteps.map((step, i) => (
            <article
              key={step.no}
              data-step
              className={cn(
                "border-t border-white/10 py-12 transition-opacity duration-500 lg:py-20",
                i === processSteps.length - 1 && "border-b",
                "lg:opacity-30",
                i === active && "lg:opacity-100",
              )}
            >
              {/* mobile plate — no pinning, so each step carries its own image */}
              <div className="relative mb-7 aspect-[16/10] w-full overflow-hidden border border-white/10 lg:hidden">
                <Image
                  src={step.image}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 to-transparent" />
              </div>

              <span className="text-eyebrow uppercase text-crimson-400">Stage {step.no}</span>
              <h3 className="mt-4 text-title text-white">{step.title}</h3>
              <p className="mt-4 max-w-measure text-white/55">
                <strong className="font-medium text-white/85">{step.sub}.</strong> {step.body}
              </p>
            </article>
          ))}

          <Link href="/services" className="link-sweep mt-12 inline-flex text-crimson-400">
            Explore the disciplines behind it
          </Link>
        </div>
      </div>
    </section>
  );
}
