"use client";

/**
 * Follow-up task engine. Distinct from the activity log: an activity records
 * what already happened, a task is scheduled work that hasn't happened yet —
 * a call to make, a site visit to do, a document to chase.
 */

import {
  addDoc, collection, doc, limit as fsLimit, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";

import type { FollowupPriority, FollowupType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, FollowupSequence, FollowupTask, Lead } from "../types";

export const TASKS = "tasks";
export const SEQUENCES = "sequences";

function mapTask(id: string, data: Record<string, unknown>): FollowupTask {
  return { id, ...(data as Omit<FollowupTask, "id">) };
}

function mapSequence(id: string, data: Record<string, unknown>): FollowupSequence {
  return { id, ...(data as Omit<FollowupSequence, "id">) };
}

export interface TaskDraft {
  leadId: string;
  leadCode: string;
  leadName?: string;
  type: FollowupType;
  title: string;
  notes?: string;
  ownerId: string;
  ownerName: string;
  priority: FollowupPriority;
  dueAt: Date;
}

export async function createTask(draft: TaskDraft, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), TASKS), {
    leadId: draft.leadId,
    leadCode: draft.leadCode,
    leadName: draft.leadName ?? "",
    type: draft.type,
    title: draft.title,
    notes: draft.notes ?? "",
    ownerId: draft.ownerId,
    ownerName: draft.ownerName,
    priority: draft.priority,
    status: "OPEN",
    dueAt: draft.dueAt,
    outcome: "",
    completedAt: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function completeTask(task: FollowupTask, outcome: string): Promise<void> {
  await updateDoc(doc(getDb(), TASKS, task.id), {
    status: "DONE",
    outcome,
    completedAt: serverTimestamp(),
  });
}

export async function cancelTask(task: FollowupTask): Promise<void> {
  await updateDoc(doc(getDb(), TASKS, task.id), { status: "CANCELLED" });
}

export async function rescheduleTask(task: FollowupTask, dueAt: Date): Promise<void> {
  await updateDoc(doc(getDb(), TASKS, task.id), { dueAt });
}

/** All tasks against one lead — sorted client-side to avoid a composite index. */
export function subscribeTasksForLead(
  leadId: string,
  cb: (rows: FollowupTask[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), TASKS), where("leadId", "==", leadId), fsLimit(200)),
    (snap) => {
      const rows = snap.docs.map((d) => mapTask(d.id, d.data()));
      rows.sort((a, b) => (a.dueAt?.toMillis?.() ?? 0) - (b.dueAt?.toMillis?.() ?? 0));
      cb(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/** Every open task org-wide, due soonest first — callers scope by owner client-side. */
export function subscribeOpenTasks(
  cb: (rows: FollowupTask[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), TASKS), where("status", "==", "OPEN"), orderBy("dueAt", "asc"), fsLimit(500)),
    (snap) => cb(snap.docs.map((d) => mapTask(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

// ---------------------------------------------------------------------------
// Follow-up sequences — admin-configured, applied on demand to a lead.
// ---------------------------------------------------------------------------

export function subscribeSequences(
  cb: (rows: FollowupSequence[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), SEQUENCES), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapSequence(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function saveSequence(
  sequence: Omit<FollowupSequence, "id" | "createdAt"> & { id?: string },
  actor: Actor,
): Promise<void> {
  const { id, ...rest } = sequence;
  if (id) {
    await updateDoc(doc(getDb(), SEQUENCES, id), { ...rest });
  } else {
    await addDoc(collection(getDb(), SEQUENCES), {
      ...rest,
      createdAt: serverTimestamp(),
      createdBy: actor,
    });
  }
}

/** Bulk-creates one task per step, due `dayOffset` days from today. */
export async function applySequence(
  lead: Pick<Lead, "id" | "code" | "ownerId" | "ownerName"> & { client?: { name?: string } },
  sequence: FollowupSequence,
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const base = new Date();

  for (const step of sequence.steps) {
    const dueAt = new Date(base);
    dueAt.setDate(dueAt.getDate() + step.dayOffset);
    const ref = doc(collection(db, TASKS));
    batch.set(ref, {
      leadId: lead.id,
      leadCode: lead.code,
      leadName: lead.client?.name ?? "",
      type: step.type,
      title: step.title,
      notes: step.notes ?? `From sequence: ${sequence.name}`,
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
      priority: "MEDIUM",
      status: "OPEN",
      dueAt,
      outcome: "",
      completedAt: null,
      createdAt: serverTimestamp(),
      createdBy: actor,
    });
  }

  await batch.commit();
}

/** Counts for the dashboard's "Today's Tasks" widget. */
export interface TaskCounts {
  byType: Partial<Record<FollowupType, number>>;
  overdue: number;
  dueToday: number;
}

export function summariseTasks(tasks: FollowupTask[]): TaskCounts {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const byType: Partial<Record<FollowupType, number>> = {};
  let overdue = 0;
  let dueToday = 0;

  for (const t of tasks) {
    if (t.status !== "OPEN") continue;
    const due = t.dueAt?.toMillis?.() ?? 0;
    if (due < startOfDay.getTime()) { overdue++; continue; }
    if (due < endOfDay.getTime()) {
      dueToday++;
      byType[t.type] = (byType[t.type] ?? 0) + 1;
    }
  }

  return { byType, overdue, dueToday };
}
