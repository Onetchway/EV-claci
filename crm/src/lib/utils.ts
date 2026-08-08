import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return inr.format(Math.round(n));
}

/** Compact Indian notation: 1,23,45,678 → ₹1.23 Cr. */
export function formatCompactINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n);
}

type MaybeTS = Timestamp | Date | string | number | null | undefined;

export function toDate(value: MaybeTS): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return null;
}

export function formatDate(value: MaybeTS): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: MaybeTS): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatRelative(value: MaybeTS): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins}m ago` : `in ${-mins}m`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return hrs > 0 ? `${hrs}h ago` : `in ${-hrs}h`;
  const days = Math.round(hrs / 24);
  if (Math.abs(days) < 30) return days > 0 ? `${days}d ago` : `in ${-days}d`;
  return formatDate(d);
}

export function daysBetween(a: MaybeTS, b: MaybeTS = new Date()): number | null {
  const d1 = toDate(a);
  const d2 = toDate(b);
  if (!d1 || !d2) return null;
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Deterministic pastel from a string — used for agent avatars. */
export function colorFromString(s: string): string {
  const palette = [
    "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500",
    "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

export function normalisePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits.slice(-10) || digits;
}

export function isValidPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(raw));
}

export function isValidEmail(raw: string): boolean {
  return !raw || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function isValidPan(raw: string): boolean {
  return !raw || PAN_RE.test(raw.trim().toUpperCase());
}

/** Extract lat/lng from a Google Maps URL when the format allows it. */
export function parseMapsLink(link: string): { lat: number; lng: number } | null {
  if (!link) return null;
  const at = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]!), lng: parseFloat(at[2]!) };
  const q = link.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]!), lng: parseFloat(q[2]!) };
  const bare = link.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (bare) return { lat: parseFloat(bare[1]!), lng: parseFloat(bare[2]!) };
  return null;
}

/** Prefix-searchable tokens. Firestore has no LIKE, so we index them ourselves. */
export function buildSearchTokens(...parts: (string | undefined | null)[]): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const clean = String(part).toLowerCase().trim();
    if (!clean) continue;
    tokens.add(clean);
    for (const word of clean.split(/[\s,./-]+/)) {
      if (word.length < 2) continue;
      tokens.add(word);
      // Prefixes let "sho" match "shoyeb" with a simple array-contains.
      for (let i = 2; i <= Math.min(word.length, 12); i++) tokens.add(word.slice(0, i));
    }
  }
  return [...tokens].slice(0, 250);
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
