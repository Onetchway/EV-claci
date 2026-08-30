"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { globalSearch, type SearchResult } from "@/lib/global-search";
import { cn } from "@/lib/utils";

export function GlobalSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setQ(""); setResults(null); }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    setBusy(true);
    const handle = setTimeout(() => {
      void globalSearch(q).then((r) => { setResults(r); setBusy(false); });
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  if (!open) return null;

  const grouped = new Map<string, SearchResult[]>();
  for (const r of results ?? []) {
    const list = grouped.get(r.type) ?? [];
    list.push(r);
    grouped.set(r.type, list);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink-950/50 pt-24" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-ink-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients, projects, quotations, BOQs, POs, vendors…"
            className="flex-1 border-none bg-transparent text-sm text-navy-900 outline-none placeholder:text-ink-400"
          />
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-96 overflow-y-auto scroll-thin p-2">
          {!q.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-ink-400">Type at least 2 characters to search everywhere.</p>
          ) : busy ? (
            <p className="px-3 py-6 text-center text-sm text-ink-400">Searching…</p>
          ) : !results || results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-400">No matches.</p>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} className="mb-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{type}</p>
                {items.map((r, i) => (
                  <Link
                    key={`${r.href}-${i}`}
                    href={r.href}
                    onClick={onClose}
                    className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-ink-100")}
                  >
                    <span className="font-medium text-navy-900">{r.label || "—"}</span>
                    {r.sublabel && <span className="text-xs text-ink-500">{r.sublabel}</span>}
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
