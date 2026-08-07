"use client";

import { useEffect, type DependencyList } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Setup = (
  g: typeof gsap,
  st: typeof ScrollTrigger,
) => void | (() => void);

/**
 * Runs a GSAP setup inside a context so every tween and ScrollTrigger it
 * creates is reverted together on unmount — the usual source of leaked
 * triggers and duplicated pins during client-side navigation.
 *
 * Skips entirely under reduced motion, leaving the markup static.
 */
export function useGSAP(setup: Setup, deps: DependencyList = []) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    let cleanup: void | (() => void);
    const ctx = gsap.context(() => {
      cleanup = setup(gsap, ScrollTrigger);
    });

    return () => {
      if (typeof cleanup === "function") cleanup();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
