"use client";

import { useScrollProgress } from "@/hooks/useScrollProgress";

export function ScrollProgress() {
  const progress = useScrollProgress();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]" aria-hidden>
      <div
        className="h-full origin-left bg-crimson transition-transform duration-100 ease-linear"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
