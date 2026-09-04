"use client";

/**
 * General CMS audit trail — distinct from `activities` (lib/db/activity.ts),
 * which is Sales/Leads-only. Nothing outside the leads pipeline (chargers,
 * tariffs, zones, workflow rules, user roles, settings) was ever logged
 * anywhere before this — the /logs page looked complete but silently only
 * covered one part of the app. Every entity type below writes through this
 * one module so there's a single place a new entity type gets wired in.
 *
 * Deliberately best-effort: a logging failure must never block the actual
 * write it's describing, so every call site should treat this as
 * fire-and-forget (see logChangeSafe) rather than awaited inline with the
 * real mutation.
 */

import {
  addDoc, collection, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, TS } from "../types";

export const CHANGE_LOG = "changeLog";

export const CHANGE_ENTITY_TYPES = [
  "CHARGER", "TARIFF", "ZONE", "WORKFLOW_RULE", "USER", "SETTINGS", "WEBHOOK", "API_KEY", "RFID_TOKEN",
  "QUOTATION", "PROFORMA_INVOICE", "PURCHASE_ORDER", "PAYROLL_PROFILE", "PAYSLIP", "EMPLOYEE_DOCUMENT",
  "EXPENSE_CLAIM",
] as const;
export type ChangeEntityType = (typeof CHANGE_ENTITY_TYPES)[number];

export const CHANGE_ACTIONS = ["CREATE", "UPDATE", "DELETE", "ACTIVATE", "DEACTIVATE"] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

export interface FieldChange {
  field: string;
  from?: unknown;
  to?: unknown;
}

export interface ChangeLogEntry {
  id: string;
  entityType: ChangeEntityType;
  entityId: string;
  /** Human-readable name at the time of the change (a charger's label, a tariff's name, ...) — kept even if the entity is later renamed or deleted, so the log stays legible. */
  entityLabel: string;
  action: ChangeAction;
  changes?: FieldChange[];
  actor: Actor;
  at: TS;
}

/** Diffs two plain objects field-by-field, skipping keys whose value didn't actually change — used by update call sites that want a real diff rather than just "something changed". */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = before[field];
    const to = after[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from, to });
  }
  return changes;
}

export async function logChange(entry: {
  entityType: ChangeEntityType;
  entityId: string;
  entityLabel: string;
  action: ChangeAction;
  changes?: FieldChange[];
  actor: Actor;
}): Promise<void> {
  await addDoc(collection(getDb(), CHANGE_LOG), { ...entry, at: serverTimestamp() });
}

/** Fire-and-forget wrapper — a logging failure (permissions, transient network) must never surface as though the real mutation it's describing failed. */
export function logChangeSafe(entry: Parameters<typeof logChange>[0]): void {
  void logChange(entry).catch((err) => console.error("[change-log] failed to write entry", err));
}

export function subscribeChangeLog(
  filters: { entityType?: ChangeEntityType; entityId?: string; max?: number },
  cb: (rows: ChangeLogEntry[]) => void,
  onError?: (e: Error) => void,
): () => void {
  // entityId alone already pins one document's history (Firestore doc IDs are
  // globally unique) — pairing it with entityType too would need a 3-field
  // composite index for no real narrowing benefit.
  const constraints = [
    ...(filters.entityId
      ? [where("entityId", "==", filters.entityId)]
      : filters.entityType ? [where("entityType", "==", filters.entityType)] : []),
    orderBy("at", "desc"),
    fsLimit(filters.max ?? 500),
  ];
  return onSnapshot(
    query(collection(getDb(), CHANGE_LOG), ...constraints),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChangeLogEntry, "id">) }))),
    (err) => onError?.(err as Error),
  );
}
