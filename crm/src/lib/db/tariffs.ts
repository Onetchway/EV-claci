"use client";

/**
 * Charging-session pricing rules. Purely CRM CRUD here — the actual
 * resolution logic (which rule applies to a given charger at a given
 * moment) is duplicated in ocpp-server/src/tariff.ts, since that's what
 * bills a session when it ends. See that file's header comment before
 * changing the resolution semantics here without mirroring it there.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { logChangeSafe } from "./change-log";
import type { Actor, Tariff } from "../types";

export const TARIFFS = "tariffs";

function mapTariff(id: string, data: Record<string, unknown>): Tariff {
  return { id, ...(data as Omit<Tariff, "id">) };
}

export function subscribeTariffs(
  cb: (rows: Tariff[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), TARIFFS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapTariff(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type TariffDraft = Omit<Tariff, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">;

export async function createTariff(draft: TariffDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), TARIFFS), {
    ...draft,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logChangeSafe({ entityType: "TARIFF", entityId: ref.id, entityLabel: draft.name, action: "CREATE", actor });
  return ref.id;
}

export async function updateTariff(id: string, draft: TariffDraft, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TARIFFS, id), {
    ...draft,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logChangeSafe({ entityType: "TARIFF", entityId: id, entityLabel: draft.name, action: "UPDATE", actor });
}

export async function setTariffActive(id: string, active: boolean, actor: Actor, name?: string): Promise<void> {
  await updateDoc(doc(getDb(), TARIFFS, id), { active, updatedAt: serverTimestamp(), updatedBy: actor });
  logChangeSafe({ entityType: "TARIFF", entityId: id, entityLabel: name ?? id, action: active ? "ACTIVATE" : "DEACTIVATE", actor });
}

export async function deleteTariff(id: string, actor?: Actor, name?: string): Promise<void> {
  await deleteDoc(doc(getDb(), TARIFFS, id));
  if (actor) logChangeSafe({ entityType: "TARIFF", entityId: id, entityLabel: name ?? id, action: "DELETE", actor });
}
