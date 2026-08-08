"use client";

import {
  addDoc, collection, limit as fsLimit, onSnapshot, orderBy, query,
  serverTimestamp, where, type QueryConstraint,
} from "firebase/firestore";

import type { ActivityType } from "../constants";
import { getDb } from "../firebase/client";
import type { Activity, Actor, FieldChange } from "../types";

/**
 * Activities live in one top-level collection rather than under each lead.
 * That way the per-lead timeline and the org-wide audit log are the same
 * query with a different `where`, and nothing has to be written twice.
 */
export const ACTIVITIES = "activities";

export interface LogInput {
  leadId: string;
  /**
   * Owning agent of the lead, copied onto the log entry. Firestore rules
   * cannot join across documents, so this is what lets an agent read their own
   * lead's history without being able to read anyone else's.
   */
  ownerId: string;
  leadCode?: string;
  leadName?: string;
  type: ActivityType;
  message: string;
  changes?: FieldChange[];
  actor: Actor;
  followUpAt?: Date | null;
  /** UIDs of teammates @mentioned in `message`. */
  mentions?: string[];
}

export async function logActivity(input: LogInput): Promise<void> {
  const db = getDb();
  await addDoc(collection(db, ACTIVITIES), {
    leadId: input.leadId,
    ownerId: input.ownerId,
    leadCode: input.leadCode ?? null,
    leadName: input.leadName ?? null,
    type: input.type,
    message: input.message,
    changes: input.changes ?? [],
    actor: input.actor,
    at: serverTimestamp(),
    followUpAt: input.followUpAt ?? null,
    mentions: input.mentions ?? [],
  });
}

/** Fire-and-forget: a failed log line must never sink the user's actual edit. */
export function logActivitySafe(input: LogInput): void {
  void logActivity(input).catch((err) => {
    console.error("[activity] failed to write log entry", err);
  });
}

function mapActivity(id: string, data: Record<string, unknown>): Activity {
  return { id, ...(data as Omit<Activity, "id">) };
}

export function subscribeLeadActivity(
  leadId: string,
  ownerId: string,
  cb: (rows: Activity[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const db = getDb();
  // `ownerId` is redundant for admins but is what satisfies the agent read rule.
  const q = query(
    collection(db, ACTIVITIES),
    where("leadId", "==", leadId),
    where("ownerId", "==", ownerId),
    orderBy("at", "desc"),
    fsLimit(300),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapActivity(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export interface AuditFilter {
  actorUid?: string;
  type?: ActivityType;
  leadId?: string;
  /** Scope to one agent's book — required for non-admin callers by the rules. */
  ownerId?: string;
  max?: number;
}

export function subscribeAuditLog(
  filter: AuditFilter,
  cb: (rows: Activity[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const db = getDb();
  const constraints: QueryConstraint[] = [];
  if (filter.leadId) constraints.push(where("leadId", "==", filter.leadId));
  if (filter.ownerId) constraints.push(where("ownerId", "==", filter.ownerId));
  if (filter.actorUid) constraints.push(where("actor.uid", "==", filter.actorUid));
  if (filter.type) constraints.push(where("type", "==", filter.type));
  constraints.push(orderBy("at", "desc"), fsLimit(filter.max ?? 400));

  return onSnapshot(
    query(collection(db, ACTIVITIES), ...constraints),
    (snap) => cb(snap.docs.map((d) => mapActivity(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
