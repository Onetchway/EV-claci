import type { Lead } from "./types";
import { normalisePhone } from "./utils";

export type DuplicateSignal = "phone" | "email" | "gstin" | "pan";

export interface DuplicateGroup {
  key: string;
  signal: DuplicateSignal;
  value: string;
  leads: Lead[];
}

/**
 * Groups leads that share a phone, email, GSTIN or PAN — the same signals
 * findDuplicateLeads (src/lib/db/leads.ts) checks before a new lead is
 * saved, run here across every lead already loaded so double-entries that
 * slipped through earlier (or predate that guard) can be found and cleaned
 * up too.
 *
 * A lead with `duplicateOverride` set (staff have confirmed it's a real,
 * separate case — e.g. the same investor buying a second franchise later,
 * not an accidental double-entry) is left out of every bucket entirely, so
 * it never gets flagged again.
 */
export function findDuplicateGroups(leads: Lead[]): DuplicateGroup[] {
  const buckets = new Map<string, { signal: DuplicateSignal; value: string; leads: Lead[] }>();

  const candidates = leads.filter((l) => !l.duplicateOverride);

  function add(signal: DuplicateSignal, raw: string | undefined, lead: Lead) {
    const trimmed = raw?.trim();
    if (!trimmed) return;
    const normalised = signal === "phone" ? normalisePhone(trimmed) : trimmed.toLowerCase();
    const minLen = signal === "phone" ? 10 : 4;
    if (normalised.length < minLen) return;

    const key = `${signal}:${normalised}`;
    const bucket = buckets.get(key) ?? { signal, value: trimmed, leads: [] };
    if (!bucket.leads.some((l) => l.id === lead.id)) bucket.leads.push(lead);
    buckets.set(key, bucket);
  }

  for (const lead of candidates) {
    add("phone", lead.client?.phone, lead);
    if (lead.client?.altPhone) add("phone", lead.client.altPhone, lead);
    add("email", lead.client?.email, lead);
    add("gstin", lead.client?.gstin, lead);
    add("pan", lead.client?.pan, lead);
  }

  return [...buckets.entries()]
    .filter(([, b]) => b.leads.length > 1)
    .map(([key, b]) => ({ key, signal: b.signal, value: b.value, leads: b.leads }));
}

/** IDs of every lead that shows up in at least one duplicate group. */
export function duplicateLeadIds(leads: Lead[]): Set<string> {
  const ids = new Set<string>();
  for (const group of findDuplicateGroups(leads)) {
    for (const lead of group.leads) ids.add(lead.id);
  }
  return ids;
}
