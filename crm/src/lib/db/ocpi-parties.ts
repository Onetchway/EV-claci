"use client";

/**
 * CRM-side management of OCPI roaming partners — generating the one-time
 * registration token (token_a) an eMSP/hub uses to complete the
 * credentials handshake at POST /api/ocpi/2.2.1/credentials (see
 * lib/ocpi/auth.ts for the server-side half of this).
 */

import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor } from "../types";

export const OCPI_PARTIES = "ocpiParties";

export interface OcpiPartyRow {
  id: string;
  partyId: string;
  countryCode: string;
  role: string;
  status: "PENDING" | "REGISTERED" | "REVOKED";
  tokenA: string;
  tokenC?: string;
  businessName?: string;
  partnerUrl?: string;
  createdAt?: unknown;
}

function mapParty(id: string, data: Record<string, unknown>): OcpiPartyRow {
  return { id, ...(data as Omit<OcpiPartyRow, "id">) };
}

export function subscribeOcpiParties(
  cb: (rows: OcpiPartyRow[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), OCPI_PARTIES), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapParty(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** 32 random bytes as a 64-char hex string — the token shape several real OCPI implementations (including test harnesses like Pipelet) expect and validate against, rather than a UUID's dashed 36-char form. OCPI itself doesn't mandate a format, but matching the common shape avoids partner-side friction. */
function randomHexToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates a pending registration and returns the token_a to share with the partner out of band — shown once, not stored anywhere else. */
export async function inviteOcpiParty(
  draft: { businessName: string },
  actor: Actor,
): Promise<{ id: string; tokenA: string }> {
  const tokenA = randomHexToken();
  const ref = doc(collection(getDb(), OCPI_PARTIES));
  await setDoc(ref, {
    status: "PENDING",
    tokenA,
    businessName: draft.businessName,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return { id: ref.id, tokenA };
}

export async function revokeOcpiParty(id: string): Promise<void> {
  await updateDoc(doc(getDb(), OCPI_PARTIES, id), { status: "REVOKED" });
}
