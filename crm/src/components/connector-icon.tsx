/**
 * Connector-type badges — a colored abbreviation chip, not a scraped/traced
 * photo of a real OEM connector. Deliberately not attempting to replicate
 * actual plug pin layouts (which are OEM trademarked shapes) — color +
 * abbreviation is enough to scan a list at a glance without the copyright
 * risk of sourcing third-party connector photography.
 *
 * Color is assigned by the connector type's fixed identity (CONNECTOR_TYPES
 * order in lib/db/charger-registry.ts), never by rank in a sorted list, so
 * a type's color never shifts as counts around it change — the single
 * source of truth other pages (CMS Dashboard's donut, etc.) should import
 * instead of redeclaring their own copy.
 */

import { CONNECTOR_TYPES } from "@/lib/db/charger-registry";
import { cn } from "@/lib/utils";

const PALETTE = ["#1fae54", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6"];

export const CONNECTOR_TYPE_COLOR: Record<string, string> = Object.fromEntries(
  CONNECTOR_TYPES.map((t, i) => [t, PALETTE[i % PALETTE.length]]),
);

const CONNECTOR_ABBR: Record<string, string> = {
  "Type 2": "T2",
  CCS2: "CCS",
  CHAdeMO: "CHA",
  "GB/T": "GBT",
  "Bharat AC-001": "AC1",
  "Bharat DC-001": "DC1",
};

export function ConnectorIcon({ type, size = 22, className }: { type: string; size?: number; className?: string }) {
  const color = CONNECTOR_TYPE_COLOR[type] ?? "#8590a8";
  const abbr = CONNECTOR_ABBR[type] ?? type.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white", className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.max(8, size * 0.32) }}
      title={type}
      aria-label={type}
    >
      {abbr}
    </span>
  );
}
