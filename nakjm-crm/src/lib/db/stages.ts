"use client";

import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { StageStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, ProjectStage } from "../types";
import { logActivitySafe } from "./activity";

export const STAGES = "stages";

function mapStage(id: string, data: Record<string, unknown>): ProjectStage {
  return { id, ...(data as Omit<ProjectStage, "id">) };
}

export function subscribeStagesForProject(projectId: string, cb: (rows: ProjectStage[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), STAGES), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapStage(d.id, d.data())).sort((a, b) => a.sequence - b.sequence)),
    (err) => onError?.(err as Error),
  );
}

export interface StageDraft {
  projectId: string;
  name: string;
  sequence: number;
  status?: StageStatus;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  notes?: string;
}

export async function createStage(draft: StageDraft, actor: Actor): Promise<ProjectStage> {
  const ref = doc(collection(getDb(), STAGES));
  const payload = {
    projectId: draft.projectId,
    name: draft.name,
    sequence: draft.sequence,
    status: draft.status ?? "NOT_STARTED",
    plannedStart: draft.plannedStart ? Timestamp.fromDate(draft.plannedStart) : null,
    plannedEnd: draft.plannedEnd ? Timestamp.fromDate(draft.plannedEnd) : null,
    actualStart: null,
    actualEnd: null,
    progressPct: 0,
    notes: draft.notes ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "STAGE", entityId: ref.id, entityLabel: draft.name, action: "CREATE",
    message: `Created stage ${draft.name}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<ProjectStage, "id">) };
}

export interface StagePatch {
  name?: string;
  sequence?: number;
  status?: StageStatus;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  progressPct?: number;
  notes?: string;
}

export async function updateStage(stage: ProjectStage, patch: StagePatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.sequence !== undefined) update.sequence = patch.sequence;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.plannedStart !== undefined) update.plannedStart = patch.plannedStart ? Timestamp.fromDate(patch.plannedStart) : null;
  if (patch.plannedEnd !== undefined) update.plannedEnd = patch.plannedEnd ? Timestamp.fromDate(patch.plannedEnd) : null;
  if (patch.actualStart !== undefined) update.actualStart = patch.actualStart ? Timestamp.fromDate(patch.actualStart) : null;
  if (patch.actualEnd !== undefined) update.actualEnd = patch.actualEnd ? Timestamp.fromDate(patch.actualEnd) : null;
  if (patch.progressPct !== undefined) update.progressPct = patch.progressPct;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await updateDoc(doc(getDb(), STAGES, stage.id), update);
  const action = patch.status && patch.status !== stage.status ? "STATUS_CHANGE" : "UPDATE";
  logActivitySafe({
    entityType: "STAGE", entityId: stage.id, entityLabel: patch.name ?? stage.name, action,
    message: action === "STATUS_CHANGE" ? `Marked stage ${stage.name} ${patch.status}` : `Edited stage ${stage.name}`,
    actor, projectId: stage.projectId,
  });
}

export async function deleteStage(stage: ProjectStage, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), STAGES, stage.id));
  logActivitySafe({
    entityType: "STAGE", entityId: stage.id, entityLabel: stage.name, action: "DELETE",
    message: `Deleted stage ${stage.name}`, actor, projectId: stage.projectId,
  });
}
