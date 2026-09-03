"use client";

/**
 * Zoho-One-style app launcher: a waffle-grid button that opens a picker for
 * "Alpha CRM" / "Alpha Projects" / "Alpha People" / "Alpha Admin" — all the
 * same shared crm/ codebase and tenant underneath, just presented as
 * separate apps the way a Zoho One customer picks between Zoho CRM, Zoho
 * Projects, Zoho People, etc. from one launcher. Purely a navigation
 * convenience layered on top of the existing sidebar — it doesn't gate
 * anything itself, so an app only shows up here when (app)/layout.tsx's own
 * feature-flag filtering has already left at least one nav item live for it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutGrid, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AlphaApp {
  key: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  homeHref: string;
  /** NAV_GROUPS labels this app corresponds to — used only to detect the "currently in this app" highlight. */
  groupLabels: string[];
}

export function AppSwitcher({ apps }: { apps: AlphaApp[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (apps.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("rounded-lg p-2 hover:bg-ink-100", open ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-800")}
        title="Switch app"
        aria-label="Switch app"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Alpha apps</p>
          <div className="grid grid-cols-2 gap-1.5">
            {apps.map((app) => {
              const appRoot = `/${app.homeHref.split("?")[0].split("/").filter(Boolean)[0] ?? ""}`;
              const active = appRoot !== "/" && pathname.startsWith(appRoot);
              const Icon = app.icon;
              return (
                <Link
                  key={app.key}
                  href={app.homeHref}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg p-2.5 text-left transition hover:bg-ink-50",
                    active && "bg-ink-50 ring-1 ring-inset ring-ink-200",
                  )}
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", app.accent)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-navy-900">{app.name}</span>
                    <span className="block text-[10px] leading-tight text-ink-500">{app.tagline}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
