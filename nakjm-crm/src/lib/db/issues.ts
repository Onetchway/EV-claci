"use client";

import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { IssuePriority, IssueStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Issue } from "../types";
import { logActivitySafe } from "./activity";

export const ISSUES = "issues";

function mapIssue(id: string, data: Record<string, unknown>): Issue {
  return { id, ...(data as Omit<Issue, "id">) };
}

export function subscribeIssuesForProject(projectId: string, cb: (rows: Issue[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), ISSUES), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapIssue(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — for a future Issues rollup on the dashboard/report centre. */
export function subscribeOpenIssues(cb: (rows: Issue[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), ISSUES), where("status", "in", ["OPEN", "IN_PROGRESS"])),
    (snap) => cb(snap.docs.map((d) => mapIssue(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface IssueDraft {
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  title: string;
  description?: string;
  priority?: IssuePriority;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: Date | null;
  raisedById?: string | null;
  raisedByName?: string;
}

export async function createIssue(draft: IssueDraft, actor: Actor): Promise<Issue> {
  const ref = doc(collection(getDb(), ISSUES));
  const payload = {
    projectId: draft.projectId,
    projectName: draft.projectName,
    stageId: draft.stageId ?? null,
    stageName: draft.stageName ?? "",
    title: draft.title,
    description: draft.description ?? "",
    priority: draft.priority ?? "MEDIUM",
    status: "OPEN" as IssueStatus,
    assigneeId: draft.assigneeId ?? null,
    assigneeName: draft.assigneeName ?? "",
    dueDate: draft.dueDate ? Timestamp.fromDate(draft.dueDate) : null,
    raisedById: draft.raisedById ?? actor.uid,
    raisedByName: draft.raisedByName ?? actor.name,
    resolution: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "ISSUE", entityId: ref.id, entityLabel: draft.title, action: "CREATE",
    message: `Raised issue ${draft.title}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Issue, "id">) };
}

export interface IssuePatch {
  title?: string;
  description?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: Date | null;
  resolution?: string;
}

export async function updateIssue(issue: Issue, patch: IssuePatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.assigneeId !== undefined) update.assigneeId = patch.assigneeId;
  if (patch.assigneeName !== undefined) update.assigneeName = patch.assigneeName;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null;
  if (patch.resolution !== undefined) update.resolution = patch.resolution;
  await updateDoc(doc(getDb(), ISSUES, issue.id), update);
  const action = patch.status && patch.status !== issue.status ? "STATUS_CHANGE" : "UPDATE";
  logActivitySafe({
    entityType: "ISSUE", entityId: issue.id, entityLabel: patch.title ?? issue.title, action,
    message: action === "STATUS_CHANGE" ? `Marked issue ${issue.title} ${patch.status}` : `Edited issue ${issue.title}`,
    actor, projectId: issue.projectId,
  });
}

export async function deleteIssue(issue: Issue, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), ISSUES, issue.id));
  logActivitySafe({
    entityType: "ISSUE", entityId: issue.id, entityLabel: issue.title, action: "DELETE",
    message: `Deleted issue ${issue.title}`, actor, projectId: issue.projectId,
  });
}
