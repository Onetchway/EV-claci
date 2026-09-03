/**
 * Field-level change detection.
 *
 * Every lead write runs through this so the activity log can say exactly what
 * moved — "Stage: EOI → Agreement", not just "someone edited this lead".
 */

import {
  FUNDING_MODE_LABEL, LOAN_STAGE_LABEL, LOCATION_TYPE_LABEL, OWNERSHIP_LABEL,
  POWER_LOAD_LABEL, SOURCE_LABEL, STAGE_META, STATUS_LABEL,
} from "./constants";
import { describeConfig } from "./pricing";
import type { FieldChange } from "./types";
import { formatDate, formatINR, toDate } from "./utils";

type Formatter = (v: unknown) => string;

const plain: Formatter = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
};

const lookup = (map: Record<string, string>): Formatter => (v) =>
  v === null || v === undefined || v === "" ? "—" : (map[String(v)] ?? String(v));

const listLookup = (map: Record<string, string>): Formatter => (v) =>
  Array.isArray(v) && v.length ? v.map((x) => map[String(x)] ?? String(x)).join(", ") : "—";

const money: Formatter = (v) => (typeof v === "number" ? formatINR(v) : "—");
const dateFmt: Formatter = (v) => formatDate(v as never);

/** Fields we track, in the order they should read in the log. */
const TRACKED: { path: string; label: string; format?: Formatter }[] = [
  { path: "stage", label: "Stage", format: (v) => STAGE_META[v as keyof typeof STAGE_META]?.label ?? plain(v) },
  { path: "status", label: "Status", format: lookup(STATUS_LABEL as Record<string, string>) },
  { path: "ownerName", label: "Assigned agent" },
  { path: "type", label: "Lead type" },
  { path: "source", label: "Source", format: lookup(SOURCE_LABEL as Record<string, string>) },
  { path: "sourceDetail", label: "Source detail" },
  { path: "client.name", label: "Client name" },
  { path: "client.phone", label: "Phone" },
  { path: "client.altPhone", label: "Alternate phone" },
  { path: "client.email", label: "Email" },
  { path: "client.company", label: "Company" },
  { path: "client.city", label: "City" },
  { path: "client.state", label: "State" },
  { path: "client.address", label: "Address" },
  { path: "client.pan", label: "PAN" },
  { path: "client.gstin", label: "GSTIN" },
  { path: "config", label: "Charger configuration", format: (v) => describeConfig(v as never) },
  { path: "extras", label: "Additional items", format: (v) =>
      Array.isArray(v) && v.length
        ? (v as { label: string; amount: number }[]).map((x) => `${x.label} ${formatINR(x.amount)}`).join(", ")
        : "—" },
  { path: "oem", label: "Charger OEM" },
  { path: "discount", label: "Discount", format: money },
  { path: "financing.mode", label: "Funding mode", format: lookup(FUNDING_MODE_LABEL as Record<string, string>) },
  { path: "financing.bank", label: "Bank" },
  { path: "financing.stage", label: "Loan stage", format: lookup(LOAN_STAGE_LABEL as Record<string, string>) },
  { path: "financing.sanctionedAmount", label: "Sanctioned amount", format: money },
  { path: "financing.disbursedAmount", label: "Disbursed amount", format: money },
  { path: "value", label: "Total value (incl. GST)", format: money },
  { path: "site.locationName", label: "Location name" },
  { path: "site.mapsLink", label: "Google Maps link" },
  { path: "site.locationTypes", label: "Location type", format: listLookup(LOCATION_TYPE_LABEL as Record<string, string>) },
  { path: "site.ownership", label: "Property owner", format: lookup(OWNERSHIP_LABEL as Record<string, string>) },
  { path: "site.commercialModelInterested", label: "Commercial model" },
  { path: "site.powerLoad", label: "Power load available", format: lookup(POWER_LOAD_LABEL as Record<string, string>) },
  { path: "site.sanctionedLoadKva", label: "Sanctioned load (kVA)" },
  { path: "site.spaceAvailableSqft", label: "Space available (sq.ft)" },
  { path: "site.nearbyLandmark", label: "Nearby landmark" },
  { path: "site.remarks", label: "Remarks" },
  { path: "tags", label: "Tags" },
  { path: "nextFollowUpAt", label: "Next follow-up", format: dateFmt },
  { path: "expectedCloseAt", label: "Expected close", format: dateFmt },
];

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  const da = toDate(a as never);
  const db = toDate(b as never);
  if (da && db) return da.getTime() === db.getTime();

  if (typeof a === "object" || typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return String(a) === String(b);
}

/**
 * Compare a lead before/after an edit. `after` may be a sparse patch — fields
 * absent from it are treated as untouched rather than as deletions.
 */
export function diffLead(before: unknown, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const { path, label, format } of TRACKED) {
    const root = path.split(".")[0]!;
    if (!(root in after)) continue;

    const from = get(before, path);
    const to = get(after, path);
    if (sameValue(from, to)) continue;

    const fmt = format ?? plain;
    changes.push({ field: path, label, from: fmt(from), to: fmt(to) });
  }

  return changes;
}

/** One-line summary for the activity feed headline. */
export function summariseChanges(changes: FieldChange[]): string {
  if (!changes.length) return "No field changes";
  if (changes.length === 1) {
    const c = changes[0]!;
    return `${c.label}: ${c.from} → ${c.to}`;
  }
  const names = changes.slice(0, 3).map((c) => c.label).join(", ");
  const rest = changes.length > 3 ? ` and ${changes.length - 3} more` : "";
  return `Updated ${names}${rest}`;
}
