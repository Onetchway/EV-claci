"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import type { ClientType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Client, ClientGstRegistration } from "../types";
import { buildSearchTokens } from "../utils";
import { logActivitySafe } from "./activity";

export const CLIENTS = "clients";

function mapClient(id: string, data: Record<string, unknown>): Client {
  return { id, ...(data as Omit<Client, "id">) };
}

export interface ClientFilters {
  active?: boolean;
  search?: string;
}

export function applyClientFilters(rows: Client[], f: ClientFilters): Client[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((c) => {
    if (f.active !== undefined && c.active !== f.active) return false;
    if (needle) {
      const hay = [c.name, c.contactName, c.contactEmail, c.contactPhone, c.city].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle) && !(c.search ?? []).some((t) => t.startsWith(needle))) return false;
    }
    return true;
  });
}

export function subscribeClients(
  filters: ClientFilters,
  cb: (rows: Client[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CLIENTS), orderBy("createdAt", "desc")),
    (snap) => cb(applyClientFilters(snap.docs.map((d) => mapClient(d.id, d.data())), filters)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeClient(id: string, cb: (c: Client | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), CLIENTS, id),
    (snap) => cb(snap.exists() ? mapClient(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getClient(id: string): Promise<Client | null> {
  const snap = await getDoc(doc(getDb(), CLIENTS, id));
  return snap.exists() ? mapClient(snap.id, snap.data()) : null;
}

export async function listActiveClients(): Promise<Client[]> {
  const snap = await getDocs(query(collection(getDb(), CLIENTS), where("active", "==", true)));
  return snap.docs.map((d) => mapClient(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export interface ClientDraft {
  name: string;
  clientType: ClientType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  gstRegistrations?: ClientGstRegistration[];
  notes?: string;
}

export async function createClient(draft: ClientDraft, actor: Actor): Promise<Client> {
  const db = getDb();
  const ref = doc(collection(db, CLIENTS));
  const payload = {
    ...draft,
    active: true,
    search: buildSearchTokens(draft.name, draft.contactName, draft.contactEmail, draft.contactPhone, draft.city),
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({ entityType: "CLIENT", entityId: ref.id, entityLabel: draft.name, action: "CREATE", message: `Added client ${draft.name}`, actor });
  return { id: ref.id, ...(payload as unknown as Omit<Client, "id">) };
}

export async function updateClient(id: string, patch: Partial<ClientDraft & { active: boolean }>): Promise<void> {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.name || patch.contactName || patch.contactEmail || patch.contactPhone || patch.city) {
    const existing = await getClient(id);
    update.search = buildSearchTokens(
      patch.name ?? existing?.name,
      patch.contactName ?? existing?.contactName,
      patch.contactEmail ?? existing?.contactEmail,
      patch.contactPhone ?? existing?.contactPhone,
      patch.city ?? existing?.city,
    );
  }
  await updateDoc(doc(getDb(), CLIENTS, id), update);
}
