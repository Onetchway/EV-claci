"use client";

import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where,
} from "firebase/firestore";

import type { ActivityAction, ActivityEntityType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Activity } from "../types";

/**
 * Every entity type (client, vendor, project, quotation, BOQ, PO, PI,
 * payment, site report) writes one append-only entry here on create/update/
 * status-change instead of its own log — one collection means the
 * org-wide Audit Log and a single entity's history are the same query with
 * a different `where`, and nothing has to be written twice.
 */
export const ACTIVITIES = "activities";

export interface LogInput {
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  action: ActivityAction;
  message: string;
  actor: Actor;
  projectId?: string | null;
}

export async function logActivity(input: LogInput): Promise<void> {
  await addDoc(collection(getDb(), ACTIVITIES), {
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    action: input.action,
    message: input.message,
    actor: input.actor,
    projectId: input.projectId ?? null,
    at: serverTimestamp(),
  });
}

/** Fire-and-forget: a failed log write must never sink the user's actual edit. */
export function logActivitySafe(input: LogInput): void {
  void logActivity(input).catch((err) => {
    console.error("[activity] failed to write log entry", err);
  });
}

function mapActivity(id: string, data: Record<string, unknown>): Activity {
  return { id, ...(data as Omit<Activity, "id">) };
}

export function subscribeEntityActivity(
  entityType: ActivityEntityType,
  entityId: string,
  cb: (rows: Activity[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ACTIVITIES), where("entityType", "==", entityType), where("entityId", "==", entityId)),
    (snap) => cb(snap.docs.map((d) => mapActivity(d.id, d.data())).sort(sortByAtDesc)),
    (err) => onError?.(err as Error),
  );
}

export interface AuditFilter {
  entityType?: ActivityEntityType;
  actorUid?: string;
  max?: number;
}

/**
 * Org-wide feed for the Audit Log page — admin-only per the Firestore
 * rules. Sorts and slices client-side (like every other list in this app)
 * so a single equality `where` never needs a composite index alongside an
 * `orderBy`.
 */
export function subscribeAuditLog(
  filter: AuditFilter,
  cb: (rows: Activity[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const base = filter.entityType
    ? query(collection(getDb(), ACTIVITIES), where("entityType", "==", filter.entityType))
    : query(collection(getDb(), ACTIVITIES));
  return onSnapshot(
    base,
    (snap) => {
      let rows = snap.docs.map((d) => mapActivity(d.id, d.data())).sort(sortByAtDesc);
      if (filter.actorUid) rows = rows.filter((r) => r.actor.uid === filter.actorUid);
      cb(rows.slice(0, filter.max ?? 300));
    },
    (err) => onError?.(err as Error),
  );
}

function sortByAtDesc(a: Activity, b: Activity): number {
  const at = (v: Activity["at"]) => (v && typeof (v as { toMillis?: () => number }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : 0);
  return at(b.at) - at(a.at);
}
