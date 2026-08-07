"use client";

import Link from "next/link";
import { useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Variant = "primary" | "outline" | "ghost" | "light";

interface ButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  /** External links open in a new tab with the right rel. */
  external?: boolean;
}

const base =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden px-8 py-4 text-eyebrow uppercase transition-colors duration-300 ease-swift disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-crimson text-white hover:bg-crimson-700",
  outline: "border border-navy/25 text-navy hover:border-navy hover:bg-navy hover:text-white",
  ghost: "border border-white/30 text-white hover:border-white hover:bg-white hover:text-navy",
  light: "bg-white text-navy hover:bg-navy-50",
};

/**
 * Magnetic button — the label drifts a few pixels toward the cursor, which
 * makes large CTAs feel responsive without any layout shift. Disabled under
 * reduced motion and on touch devices, where there is no cursor to track.
 */
export function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  className,
  disabled,
  external,
}: ButtonProps) {
  const inner = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const handleMove = (e: MouseEvent<HTMLElement>) => {
    if (reduced || !inner.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
    inner.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const handleLeave = () => {
    if (inner.current) inner.current.style.transform = "translate3d(0,0,0)";
  };

  const content = (
    <>
      <span
        ref={inner}
        className="relative z-10 flex items-center gap-3 transition-transform duration-500 ease-editorial"
      >
        {children}
        <span aria-hidden className="transition-transform duration-300 ease-swift group-hover:translate-x-1">
          →
        </span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-swift group-hover:translate-x-full"
      />
    </>
  );

  const classes = cn(base, variants[variant], className);

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} onMouseMove={handleMove} onMouseLeave={handleLeave}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {content}
    </button>
  );
}
