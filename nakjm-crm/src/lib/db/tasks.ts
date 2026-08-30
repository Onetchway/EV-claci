"use client";

import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { TaskStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, ProjectTask } from "../types";
import { logActivitySafe } from "./activity";

export const TASKS = "tasks";

function mapTask(id: string, data: Record<string, unknown>): ProjectTask {
  return { id, ...(data as Omit<ProjectTask, "id">) };
}

export function subscribeTasksForProject(projectId: string, cb: (rows: ProjectTask[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), TASKS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapTask(d.id, d.data())).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface TaskDraft {
  projectId: string;
  stageId: string;
  stageName: string;
  title: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: Date | null;
  notes?: string;
}

export async function createTask(draft: TaskDraft, actor: Actor): Promise<ProjectTask> {
  const ref = doc(collection(getDb(), TASKS));
  const payload = {
    projectId: draft.projectId,
    stageId: draft.stageId,
    stageName: draft.stageName,
    title: draft.title,
    status: draft.status ?? "OPEN",
    assigneeId: draft.assigneeId ?? null,
    assigneeName: draft.assigneeName ?? "",
    dueDate: draft.dueDate ? Timestamp.fromDate(draft.dueDate) : null,
    completedAt: null,
    notes: draft.notes ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "TASK", entityId: ref.id, entityLabel: draft.title, action: "CREATE",
    message: `Created task ${draft.title}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<ProjectTask, "id">) };
}

export interface TaskPatch {
  title?: string;
  stageId?: string;
  stageName?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: Date | null;
  notes?: string;
}

export async function updateTask(task: ProjectTask, patch: TaskPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.stageId !== undefined) update.stageId = patch.stageId;
  if (patch.stageName !== undefined) update.stageName = patch.stageName;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.completedAt = patch.status === "DONE" ? serverTimestamp() : null;
  }
  if (patch.assigneeId !== undefined) update.assigneeId = patch.assigneeId;
  if (patch.assigneeName !== undefined) update.assigneeName = patch.assigneeName;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await updateDoc(doc(getDb(), TASKS, task.id), update);
  const action = patch.status && patch.status !== task.status ? "STATUS_CHANGE" : "UPDATE";
  logActivitySafe({
    entityType: "TASK", entityId: task.id, entityLabel: patch.title ?? task.title, action,
    message: action === "STATUS_CHANGE" ? `Marked task ${task.title} ${patch.status}` : `Edited task ${task.title}`,
    actor, projectId: task.projectId,
  });
}

export async function deleteTask(task: ProjectTask, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), TASKS, task.id));
  logActivitySafe({
    entityType: "TASK", entityId: task.id, entityLabel: task.title, action: "DELETE",
    message: `Deleted task ${task.title}`, actor, projectId: task.projectId,
  });
}
