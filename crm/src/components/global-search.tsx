"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Handshake, Search, Users2 } from "lucide-react";

import { globalSearch, type SearchResult } from "@/lib/search";

const ICON = { lead: Users2, project: Building2, partner: Handshake } as const;

export function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await globalSearch(term);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search leads, projects, partners…"
        className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
      />

      {open && term.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-ink-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink-500">No matches.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto scroll-thin">
              {results.map((r) => {
                const Icon = ICON[r.kind];
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={r.href}
                      onClick={() => { setOpen(false); setTerm(""); }}
                      className="flex items-center gap-2.5 border-b border-ink-50 px-3 py-2 last:border-0 hover:bg-ink-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{r.title}</span>
                        <span className="block truncate text-xs text-ink-500">{r.subtitle}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
