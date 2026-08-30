"use client";

import {
  arrayUnion, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { HandoverStage, PunchItemStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Handover, PunchItem } from "../types";
import { logActivitySafe } from "./activity";

export const PUNCH_ITEMS = "punchItems";
export const HANDOVERS = "handovers";

function mapPunchItem(id: string, data: Record<string, unknown>): PunchItem {
  return { id, ...(data as Omit<PunchItem, "id">) };
}

function mapHandover(id: string, data: Record<string, unknown>): Handover {
  return { id, ...(data as Omit<Handover, "id">) };
}

// ── Punch list ─────────────────────────────────────────────────────────

export function subscribePunchItemsForProject(projectId: string, cb: (rows: PunchItem[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PUNCH_ITEMS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapPunchItem(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface PunchItemDraft {
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  description: string;
  assignedToId?: string | null;
  assignedToName?: string;
  dueDate?: Date | null;
}

export async function createPunchItem(draft: PunchItemDraft, actor: Actor): Promise<PunchItem> {
  const ref = doc(collection(getDb(), PUNCH_ITEMS));
  const payload = {
    projectId: draft.projectId,
    projectName: draft.projectName,
    stageId: draft.stageId ?? null,
    stageName: draft.stageName ?? "",
    description: draft.description,
    assignedToId: draft.assignedToId ?? null,
    assignedToName: draft.assignedToName ?? "",
    dueDate: draft.dueDate ? Timestamp.fromDate(draft.dueDate) : null,
    status: "OPEN" as PunchItemStatus,
    resolution: "",
    clientAccepted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "PUNCH_ITEM", entityId: ref.id, entityLabel: draft.description, action: "CREATE",
    message: `Added punch item: ${draft.description}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<PunchItem, "id">) };
}

export interface PunchItemPatch {
  status?: PunchItemStatus;
  resolution?: string;
  clientAccepted?: boolean;
}

export async function updatePunchItem(item: PunchItem, patch: PunchItemPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.resolution !== undefined) update.resolution = patch.resolution;
  if (patch.clientAccepted !== undefined) update.clientAccepted = patch.clientAccepted;
  await updateDoc(doc(getDb(), PUNCH_ITEMS, item.id), update);
  const action = patch.status && patch.status !== item.status ? "STATUS_CHANGE" : "UPDATE";
  logActivitySafe({
    entityType: "PUNCH_ITEM", entityId: item.id, entityLabel: item.description, action,
    message: action === "STATUS_CHANGE" ? `Marked punch item ${patch.status}` : `Updated punch item`,
    actor, projectId: item.projectId,
  });
}

// ── Handover ───────────────────────────────────────────────────────────

/** One handover doc per project, keyed by the project's own id for a trivial lookup. */
export async function getOrCreateHandover(projectId: string, projectName: string): Promise<Handover> {
  const ref = doc(getDb(), HANDOVERS, projectId);
  const snap = await getDoc(ref);
  if (snap.exists()) return mapHandover(snap.id, snap.data());
  const payload = {
    projectId, projectName, stage: "EXECUTION_COMPLETE" as HandoverStage, history: [],
    completionDocumentIds: [], notes: "", handoverDate: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id: projectId, ...(payload as unknown as Omit<Handover, "id">) };
}

export function subscribeHandover(projectId: string, cb: (h: Handover | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), HANDOVERS, projectId),
    (snap) => cb(snap.exists() ? mapHandover(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function advanceHandoverStage(handover: Handover, stage: HandoverStage, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = {
    stage,
    history: arrayUnion({ stage, at: Timestamp.now(), byId: actor.uid, byName: actor.name }),
    updatedAt: serverTimestamp(),
  };
  if (stage === "HANDED_OVER") update.handoverDate = serverTimestamp();
  await updateDoc(doc(getDb(), HANDOVERS, handover.id), update);
  logActivitySafe({
    entityType: "HANDOVER", entityId: handover.id, entityLabel: handover.projectName, action: "STATUS_CHANGE",
    message: `Handover moved to ${stage.replace(/_/g, " ")}`, actor, projectId: handover.projectId,
  });
}

export async function attachCompletionDocument(handover: Handover, documentId: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), HANDOVERS, handover.id), {
    completionDocumentIds: arrayUnion(documentId), updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "HANDOVER", entityId: handover.id, entityLabel: handover.projectName, action: "UPDATE",
    message: `Attached completion document`, actor, projectId: handover.projectId,
  });
}
