"use client";

/**
 * Client-side reads for CPO↔CPO roaming — the partner records, sessions,
 * and CDRs are all written server-side (Admin SDK, see
 * lib/ocpi/roaming-client.ts and the api/ocpi/2.2.1/roaming/* routes); this
 * module only subscribes to them for the CRM's /roaming page, plus the
 * fetch wrappers for the write-side API routes (registration/start/stop —
 * those need the outbound handshake and partner bearer tokens, which only
 * belong server-side).
 */

import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { getDb, getFirebaseAuth } from "../firebase/client";

export const ROAMING_PARTNERS = "ocpiRoamingPartners";
export const ROAMING_SESSIONS = "roamingSessions";
export const ROAMING_COMMANDS = "roamingCommands";

export interface RoamingPartnerRow {
  id: string;
  businessName: string;
  versionsUrl: string;
  status: "PENDING" | "REGISTERED" | "REVOKED";
  endpoints?: Record<string, string>;
}

export interface RoamingSessionRow {
  id: string;
  partnerId: string;
  partnerName: string;
  status: string;
  kwh?: number;
  currency?: string;
  start_date_time?: string;
  end_date_time?: string;
}

function mapDoc<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...(data as object) } as T;
}

export function subscribeRoamingPartners(cb: (rows: RoamingPartnerRow[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    collection(getDb(), ROAMING_PARTNERS),
    (snap) => cb(snap.docs.map((d) => mapDoc<RoamingPartnerRow>(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRoamingSessions(cb: (rows: RoamingSessionRow[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), ROAMING_SESSIONS), orderBy("receivedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapDoc<RoamingSessionRow>(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRoamingCommand(
  rid: string,
  cb: (row: { result: string; message?: { text: string } } | null) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ROAMING_COMMANDS), where("__name__", "==", rid)),
    (snap) => cb(snap.empty ? null : mapDoc(snap.docs[0]!.id, snap.docs[0]!.data())),
  );
}

async function authedFetch(path: string, body: unknown): Promise<Record<string, unknown>> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

export async function registerRoamingPartner(draft: { businessName: string; versionsUrl: string; theirTokenA: string }) {
  return authedFetch("/api/ocpi/2.2.1/roaming/partners", draft);
}

export async function pullRoamingLocations(partnerId: string): Promise<unknown[]> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(`/api/ocpi/2.2.1/roaming/partners/${partnerId}/locations`, { headers: { authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data.locations as unknown[];
}

export async function startRoamingSession(partnerId: string, draft: { locationId: string; evseUid?: string; idToken: string }) {
  return authedFetch(`/api/ocpi/2.2.1/roaming/partners/${partnerId}/start`, draft);
}

export async function stopRoamingSession(partnerId: string, sessionId: string) {
  return authedFetch(`/api/ocpi/2.2.1/roaming/partners/${partnerId}/stop`, { sessionId });
}
