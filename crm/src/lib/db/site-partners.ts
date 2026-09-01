"use client";

/**
 * Site Partners — a person or company offering one or more locations for a
 * charging station. Used to be a filtered view of type=SITE leads (one lead
 * per location), which meant a partner offering 5-20 locations at once (a
 * DISCOM like BSES, say) had to be entered as that many separate leads.
 * Locations live as an array on the partner doc so adding another one is
 * just appending to the same record, and mapping one onto a Franchise lead
 * is a straight copy of its SiteInfo fields.
 */

import {
  arrayUnion, collection, deleteDoc, doc, getDocs, limit as fsLimit,
  onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Lead, SiteLocation, SitePartner } from "../types";
import type { Source } from "../constants";
import { LEADS } from "./leads";

export const SITE_PARTNERS = "sitePartners";
const COUNTERS = "counters";

function mapSitePartner(id: string, data: Record<string, unknown>): SitePartner {
  return { id, ...(data as Omit<SitePartner, "id">) };
}

async function nextSitePartnerCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, COUNTERS, "sitePartners");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
  return `LG-SP-${String(seq).padStart(6, "0")}`;
}

let locationSeq = 0;
export function blankLocation(): SiteLocation {
  return {
    id: `loc${Date.now()}${locationSeq++}`,
    locationName: "", mapsLink: "", address: "", locationTypes: [], ownership: null,
    commercialModelInterested: false, powerLoad: null, sanctionedLoadKva: null,
    spaceAvailableSqft: null, nearbyLandmark: "", remarks: "",
    status: "AVAILABLE",
    linkedLeadId: null, linkedLeadCode: null,
    createdAt: null,
  };
}

export interface SitePartnerDraft {
  contactName: string;
  phone: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  address?: string;
  source: Source;
  sourceDetail?: string;
  notes?: string;
  ownerId: string;
  ownerName: string;
  locations: SiteLocation[];
  tags?: string[];
}

export async function createSitePartner(draft: SitePartnerDraft, actor: Actor): Promise<{ id: string; code: string }> {
  const code = await nextSitePartnerCode();
  const ref = doc(collection(getDb(), SITE_PARTNERS));
  const now = new Date();
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      code,
      contactName: draft.contactName,
      phone: draft.phone,
      email: draft.email ?? "",
      company: draft.company ?? "",
      city: draft.city ?? "",
      state: draft.state ?? "",
      address: draft.address ?? "",
      source: draft.source,
      sourceDetail: draft.sourceDetail ?? "",
      notes: draft.notes ?? "",
      status: "ACTIVE",
      ownerId: draft.ownerId,
      ownerName: draft.ownerName,
      locations: draft.locations.map((l) => ({ ...l, createdAt: now })),
      tags: draft.tags ?? [],
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  });
  return { id: ref.id, code };
}

export interface SitePartnerPatch {
  contactName?: string;
  phone?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  address?: string;
  source?: Source;
  sourceDetail?: string;
  notes?: string;
  status?: "ACTIVE" | "INACTIVE";
  ownerId?: string;
  ownerName?: string;
  tags?: string[];
}

export async function updateSitePartner(id: string, patch: SitePartnerPatch, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), SITE_PARTNERS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function deleteSitePartner(partner: SitePartner): Promise<void> {
  await deleteDoc(doc(getDb(), SITE_PARTNERS, partner.id));
}

/** Appends one more location to an existing partner — the "BSES gives us a 6th site" case. */
export async function addLocation(partner: SitePartner, location: SiteLocation, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), SITE_PARTNERS, partner.id), {
    locations: arrayUnion({ ...location, createdAt: new Date() }),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function updateLocation(partner: SitePartner, location: SiteLocation, actor: Actor): Promise<void> {
  const next = partner.locations.map((l) => (l.id === location.id ? location : l));
  await updateDoc(doc(getDb(), SITE_PARTNERS, partner.id), {
    locations: next,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function removeLocation(partner: SitePartner, locationId: string, actor: Actor): Promise<void> {
  const next = partner.locations.filter((l) => l.id !== locationId);
  await updateDoc(doc(getDb(), SITE_PARTNERS, partner.id), {
    locations: next,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

/** Called once the Franchise lead built on this location is actually saved, so the location stops showing as available. */
export async function markLocationMapped(
  partnerId: string, locationId: string, lead: { id: string; code: string },
): Promise<void> {
  const ref = doc(getDb(), SITE_PARTNERS, partnerId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const partner = mapSitePartner(snap.id, snap.data());
    const next = partner.locations.map((l) =>
      l.id === locationId ? { ...l, status: "MAPPED" as const, linkedLeadId: lead.id, linkedLeadCode: lead.code } : l);
    tx.update(ref, { locations: next });
  });
}

export function subscribeSitePartners(
  filters: { ownerId?: string; max?: number },
  cb: (rows: SitePartner[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = filters.ownerId ? [where("ownerId", "==", filters.ownerId)] : [];
  return onSnapshot(
    query(collection(getDb(), SITE_PARTNERS), ...constraints, orderBy("createdAt", "desc"), fsLimit(filters.max ?? 2000)),
    (snap) => cb(snap.docs.map((d) => mapSitePartner(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSitePartner(
  id: string,
  cb: (row: SitePartner | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), SITE_PARTNERS, id),
    (snap) => cb(snap.exists() ? mapSitePartner(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export interface LocationSearchResult {
  partner: SitePartner;
  location: SiteLocation;
}

/**
 * Powers the "Map existing location" picker on the Franchise lead form —
 * every AVAILABLE location across every partner, grouped by partner so the
 * agent can see "which location, whose list" rather than a flat pile of
 * addresses. Client-side filtered by name; the partner set is small enough
 * (tens to low hundreds) that fetching all of them is simpler and cheaper
 * than a server-side text search.
 */
export async function searchAvailableLocations(searchTerm: string): Promise<LocationSearchResult[]> {
  const snap = await getDocs(query(collection(getDb(), SITE_PARTNERS), where("status", "==", "ACTIVE"), fsLimit(500)));
  const needle = searchTerm.trim().toLowerCase();
  const results: LocationSearchResult[] = [];
  for (const d of snap.docs) {
    const partner = mapSitePartner(d.id, d.data());
    for (const location of partner.locations) {
      if (location.status !== "AVAILABLE") continue;
      if (needle) {
        const haystack = [
          partner.contactName, partner.company, partner.city,
          location.locationName, location.address, location.nearbyLandmark,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      results.push({ partner, location });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Legacy import
// ---------------------------------------------------------------------------

function leadSiteToLocation(lead: Lead): SiteLocation {
  const site = lead.site ?? {};
  return {
    ...site,
    id: `loc${Date.now()}${locationSeq++}`,
    status: lead.status === "REJECTED" ? "REJECTED" : "AVAILABLE",
    linkedLeadId: null,
    linkedLeadCode: null,
    createdAt: lead.createdAt ?? null,
  };
}

export interface LegacySiteLeadImportResult {
  migrated: number;
}

/**
 * One-time-per-lead import: Site Enquiries used to be type=SITE leads (one
 * lead per location). Those leads still live in the leads collection and
 * never automatically became Site Partner records when this module was
 * introduced, so this brings each un-migrated one across as its own partner
 * with a single location, then flags the lead so a second run is a no-op.
 */
export async function importLegacySiteLeads(actor: Actor): Promise<LegacySiteLeadImportResult> {
  const snap = await getDocs(query(collection(getDb(), LEADS), where("type", "==", "SITE")));
  let migrated = 0;
  for (const d of snap.docs) {
    const lead = { id: d.id, ...(d.data() as Omit<Lead, "id">) } as Lead;
    if (lead.migratedToSitePartnerId || lead.deletedAt) continue;
    const { id } = await createSitePartner({
      contactName: lead.client?.name || "Unknown",
      phone: lead.client?.phone || "",
      email: lead.client?.email,
      company: lead.client?.company,
      city: lead.client?.city,
      state: lead.client?.state,
      address: lead.client?.address,
      source: lead.source,
      sourceDetail: lead.sourceDetail,
      notes: lead.site?.remarks,
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
      locations: [leadSiteToLocation(lead)],
      tags: lead.tags,
    }, actor);
    await updateDoc(doc(getDb(), LEADS, lead.id), {
      migratedToSitePartnerId: id,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
    migrated += 1;
  }
  return { migrated };
}
