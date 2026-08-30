"use client";

import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { InspectionResult, NcrStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Inspection, Ncr } from "../types";
import { logActivitySafe } from "./activity";

export const INSPECTIONS = "inspections";
export const NCRS = "ncrs";

function mapInspection(id: string, data: Record<string, unknown>): Inspection {
  return { id, ...(data as Omit<Inspection, "id">) };
}

function mapNcr(id: string, data: Record<string, unknown>): Ncr {
  return { id, ...(data as Omit<Ncr, "id">) };
}

export function subscribeInspectionsForProject(projectId: string, cb: (rows: Inspection[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), INSPECTIONS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapInspection(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeNcrsForProject(projectId: string, cb: (rows: Ncr[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), NCRS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapNcr(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface InspectionDraft {
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  checklist: string;
  result: InspectionResult;
  remarks?: string;
}

export async function createInspection(draft: InspectionDraft, actor: Actor): Promise<Inspection> {
  const ref = doc(collection(getDb(), INSPECTIONS));
  const payload = {
    projectId: draft.projectId,
    projectName: draft.projectName,
    stageId: draft.stageId ?? null,
    stageName: draft.stageName ?? "",
    checklist: draft.checklist,
    result: draft.result,
    remarks: draft.remarks ?? "",
    inspectedById: actor.uid,
    inspectedByName: actor.name,
    inspectedAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "INSPECTION", entityId: ref.id, entityLabel: draft.checklist, action: "CREATE",
    message: `Recorded inspection "${draft.checklist}" — ${draft.result}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Inspection, "id">) };
}

export interface NcrDraft {
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  issue: string;
  location?: string;
  responsiblePersonId?: string | null;
  responsiblePersonName?: string;
}

export async function createNcr(draft: NcrDraft, actor: Actor): Promise<Ncr> {
  const ref = doc(collection(getDb(), NCRS));
  const payload = {
    projectId: draft.projectId,
    projectName: draft.projectName,
    stageId: draft.stageId ?? null,
    stageName: draft.stageName ?? "",
    issue: draft.issue,
    location: draft.location ?? "",
    responsiblePersonId: draft.responsiblePersonId ?? null,
    responsiblePersonName: draft.responsiblePersonName ?? "",
    correctiveAction: "",
    status: "OPEN" as NcrStatus,
    closureDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "NCR", entityId: ref.id, entityLabel: draft.issue, action: "CREATE",
    message: `Raised NCR: ${draft.issue}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Ncr, "id">) };
}

export interface NcrPatch {
  correctiveAction?: string;
  status?: NcrStatus;
}

export async function updateNcr(ncr: Ncr, patch: NcrPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.correctiveAction !== undefined) update.correctiveAction = patch.correctiveAction;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.closureDate = patch.status === "CLOSED" ? serverTimestamp() : null;
  }
  await updateDoc(doc(getDb(), NCRS, ncr.id), update);
  const action = patch.status && patch.status !== ncr.status ? "STATUS_CHANGE" : "UPDATE";
  logActivitySafe({
    entityType: "NCR", entityId: ncr.id, entityLabel: ncr.issue, action,
    message: action === "STATUS_CHANGE" ? `Marked NCR ${ncr.issue} ${patch.status}` : `Edited NCR ${ncr.issue}`,
    actor, projectId: ncr.projectId,
  });
}
