"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@/hooks/useGSAP";
import { projects } from "@/lib/data/projects";
import { SectionHeading } from "@/components/ui/SectionHeading";

const featured = projects.slice(0, 6);

/**
 * Apple-style horizontal rail: the section pins and the track translates
 * sideways with scroll. Below the desktop breakpoint it degrades to a native
 * swipeable rail, which feels better on touch than a hijacked scroll.
 */
export function HorizontalProjects() {
  const root = useRef<HTMLElement>(null);

  useGSAP((gsap, ScrollTrigger) => {
    const el = root.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      const track = el.querySelector<HTMLElement>("[data-track]");
      if (!track) return;

      const distance = () => track.scrollWidth - window.innerWidth + 160;

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="relative overflow-hidden bg-white py-section lg:py-0">
      <div className="lg:flex lg:h-screen lg:flex-col lg:justify-center">
        <div className="shell">
          <SectionHeading
            eyebrow="Selected work"
            title="Delivered at"
            accent="national scale."
            lede="Highway megahubs, OEM depots, industrial estates and institutional campuses — executed by the same in-house teams."
          />
        </div>

        <div className="mt-14 lg:mt-16">
          <div
            data-track
            className="flex gap-6 overflow-x-auto px-[var(--shell-pad)] pb-6 no-scrollbar lg:overflow-visible lg:pb-0"
          >
            {featured.map((project) => (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}/`}
                className="group relative block w-[78vw] shrink-0 overflow-hidden bg-navy-950 sm:w-[52vw] lg:w-[27vw]"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:h-[clamp(20rem,calc(100vh-26rem),44rem)]">
                  <Image
                    src={project.hero}
                    alt={project.title}
                    fill
                    sizes="(max-width: 640px) 78vw, (max-width: 1024px) 52vw, 27vw"
                    className="object-cover transition-transform duration-[1.2s] ease-editorial group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,10,28,0.95)_0%,rgba(0,10,28,0.6)_38%,rgba(0,10,28,0.05)_75%)]" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-7 lg:p-9">
                  <span className="text-eyebrow uppercase text-crimson-400">
                    {project.category} · {project.location}
                  </span>
                  <h3 className="mt-3 max-w-[20ch] text-2xl font-medium leading-tight tracking-tight text-white">
                    {project.title}
                  </h3>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/20 pt-4">
                    {project.metrics.slice(0, 2).map((m) => (
                      <span key={m.label} className="text-sm text-white/70">
                        <span className="font-medium text-white">{m.value}</span>{" "}
                        <span className="text-white/60">{m.label.toLowerCase()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href="/projects"
              className="group flex w-[78vw] shrink-0 items-center justify-center border border-navy/15 bg-mist sm:w-[52vw] lg:w-[26vw]"
            >
              <span className="text-center">
                <span className="block text-2xl font-medium tracking-tight text-navy">
                  All projects
                </span>
                <span className="mt-3 block text-eyebrow uppercase text-crimson">
                  View the full portfolio →
                </span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
