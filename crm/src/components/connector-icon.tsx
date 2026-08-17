/**
 * Connector-type icons — a schematic pin-layout diagram (housing + pin
 * dots), not a traced/scraped photo of a real OEM connector. Pin count and
 * rough arrangement are drawn from the public IEC 62196 / GB/T / Bharat AC-
 * DC-001 standard diagrams (the same kind of schematic every EV app draws
 * these from), not from any single vendor's product photography — so this
 * stays clear of the copyright risk that sourcing internet connector
 * photos would carry, while still being recognizable at a glance instead
 * of a plain text abbreviation.
 *
 * Color is assigned by the connector type's fixed identity (CONNECTOR_TYPES
 * order in lib/db/charger-registry.ts), never by rank in a sorted list, so
 * a type's color never shifts as counts around it change — the single
 * source of truth other pages (CMS Dashboard's donut, etc.) should import
 * instead of redeclaring their own copy. It renders as the housing ring,
 * with pins in a fixed neutral tone so the diagram reads the same at any
 * size.
 */

import { CONNECTOR_TYPES } from "@/lib/db/charger-registry";
import { cn } from "@/lib/utils";

const PALETTE = ["#1fae54", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6"];

export const CONNECTOR_TYPE_COLOR: Record<string, string> = Object.fromEntries(
  CONNECTOR_TYPES.map((t, i) => [t, PALETTE[i % PALETTE.length]]),
);

const PIN = "#3a4351";
const PIN_HL = "#6b7688";
const HOUSING = "#eef0f3";

function Pin({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={PIN} stroke={PIN_HL} strokeWidth={r * 0.18} />;
}

/** Type 2 / Mennekes — 7 contacts: 2 small pilot pins (CP/PP) up top, 5 larger power pins (L1/L2/L3/N/PE) in an arc below. */
function Type2Pins() {
  return (
    <>
      <Pin cx={38} cy={32} r={4.5} />
      <Pin cx={62} cy={32} r={4.5} />
      <Pin cx={28} cy={54} r={7} />
      <Pin cx={50} cy={48} r={7} />
      <Pin cx={72} cy={54} r={7} />
      <Pin cx={37} cy={70} r={7} />
      <Pin cx={63} cy={70} r={7} />
    </>
  );
}

/** CHAdeMO — larger housing, 2 big DC power pins plus a ring of smaller signal pins, with a flat key tab at top. */
function ChademoPins() {
  return (
    <>
      <Pin cx={35} cy={45} r={11} />
      <Pin cx={65} cy={45} r={11} />
      <Pin cx={50} cy={68} r={6} />
      <Pin cx={30} cy={68} r={4} />
      <Pin cx={70} cy={68} r={4} />
      <Pin cx={50} cy={28} r={4} />
    </>
  );
}

/** Bharat DC-001 / GB/T DC — 9-pin round layout: 3 across the top, 2 large mid pins flanking a center pin, 2 small lower pins, plus a top key tab. */
function BharatDcPins() {
  return (
    <>
      <Pin cx={38} cy={30} r={4.5} />
      <Pin cx={50} cy={26} r={4.5} />
      <Pin cx={62} cy={30} r={4.5} />
      <Pin cx={27} cy={48} r={4} />
      <Pin cx={73} cy={48} r={4} />
      <Pin cx={35} cy={52} r={8} />
      <Pin cx={65} cy={52} r={8} />
      <Pin cx={50} cy={58} r={7} />
      <Pin cx={41} cy={74} r={3.5} />
      <Pin cx={59} cy={74} r={3.5} />
    </>
  );
}

/** Bharat AC-001 — 3 round pins in a triangular arrangement. */
function BharatAcPins() {
  return (
    <>
      <Pin cx={35} cy={42} r={7} />
      <Pin cx={65} cy={42} r={7} />
      <Pin cx={50} cy={65} r={7} />
    </>
  );
}

type Family = "type2" | "ccs2" | "chademo" | "dc9pin" | "ac3pin";

const CONNECTOR_FAMILY: Record<string, Family> = {
  "Type 2": "type2",
  CCS2: "ccs2",
  CHAdeMO: "chademo",
  "GB/T": "dc9pin",
  "Bharat AC-001": "ac3pin",
  "Bharat DC-001": "dc9pin",
};

function ConnectorSvg({ family }: { family: Family }) {
  if (family === "ccs2") {
    // Combo shape: the Type 2 housing on top, fused with two large DC pins below — the "keyhole" silhouette that distinguishes CCS2 from plain Type 2.
    return (
      <svg viewBox="0 0 100 130" className="h-full w-full">
        <circle cx={50} cy={42} r={38} fill={HOUSING} />
        <rect x={20} y={78} width={60} height={44} rx={20} fill={HOUSING} />
        <g transform="translate(0,-6) scale(0.86) translate(8,6)"><Type2Pins /></g>
        <Pin cx={35} cy={100} r={11} />
        <Pin cx={65} cy={100} r={11} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <circle cx={50} cy={50} r={46} fill={HOUSING} />
      {family === "type2" && <Type2Pins />}
      {family === "chademo" && <ChademoPins />}
      {family === "dc9pin" && <BharatDcPins />}
      {family === "ac3pin" && <BharatAcPins />}
    </svg>
  );
}

export function ConnectorIcon({ type, size = 22, className }: { type: string; size?: number; className?: string }) {
  const color = CONNECTOR_TYPE_COLOR[type] ?? "#8590a8";
  const family = CONNECTOR_FAMILY[type] ?? "type2";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-[2px]", className)}
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${color}` }}
      title={type}
      aria-label={type}
    >
      <ConnectorSvg family={family} />
    </span>
  );
}
