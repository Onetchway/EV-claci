"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { projects, projectCategories } from "@/lib/data/projects";
import { cn } from "@/lib/utils";

const spanClass: Record<string, string> = {
  tall: "lg:row-span-2 aspect-[3/4] lg:aspect-auto",
  wide: "lg:col-span-2 aspect-[16/10]",
  regular: "aspect-[4/3]",
};

/** Filterable masonry-style gallery with animated re-flow. */
export function ProjectGallery() {
  const [filter, setFilter] = useState<string>("All");

  const visible = useMemo(
    () => (filter === "All" ? projects : projects.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <section className="bg-white py-section">
      <div className="shell">
        {/* filters — a rule of text, not a row of pills */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-navy/10 pb-6">
          {["All", ...projectCategories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={cn(
                "relative py-2 text-eyebrow uppercase transition-colors duration-300",
                filter === cat ? "text-crimson" : "text-ink/40 hover:text-navy",
              )}
            >
              {cat}
              {filter === cat ? (
                <motion.span
                  layoutId="filter-underline"
                  className="absolute inset-x-0 -bottom-[25px] h-px bg-crimson"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null}
            </button>
          ))}

          <span className="ml-auto text-sm tabular-nums text-ink/30">
            {visible.length} {visible.length === 1 ? "project" : "projects"}
          </span>
        </div>

        <motion.div
          layout
          className="mt-12 grid auto-rows-[minmax(0,auto)] gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((project) => (
              <motion.article
                key={project.slug}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className={cn("group relative", spanClass[project.span ?? "regular"])}
              >
                <Link
                  href={`/projects/${project.slug}/`}
                  className="relative block h-full w-full overflow-hidden bg-navy-950"
                >
                  <Image
                    src={project.hero}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-[1.3s] ease-editorial group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,10,28,0.94)_0%,rgba(0,10,28,0.55)_42%,rgba(0,10,28,0.05)_80%)]" />

                  <div className="absolute inset-x-0 bottom-0 p-7">
                    <span className="text-eyebrow uppercase text-crimson-400">
                      {project.category}
                    </span>
                    <h2 className="mt-3 max-w-[24ch] text-xl font-medium leading-tight tracking-tight text-white">
                      {project.title}
                    </h2>
                    <p className="mt-2 text-sm text-white/50">
                      {project.location} · {project.completion}
                    </p>
                  </div>
                </Link>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
