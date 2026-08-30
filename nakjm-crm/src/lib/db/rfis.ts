"use client";

import {
  arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { RfiStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Rfi } from "../types";
import { logActivitySafe } from "./activity";

export const RFIS = "rfis";

function mapRfi(id: string, data: Record<string, unknown>): Rfi {
  return { id, ...(data as Omit<Rfi, "id">) };
}

export function subscribeRfisForProject(projectId: string, cb: (rows: Rfi[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), RFIS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapRfi(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level RFI page across every project. */
export function subscribeRfis(cb: (rows: Rfi[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), RFIS)),
    (snap) => cb(snap.docs.map((d) => mapRfi(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface RfiDraft {
  projectId: string;
  projectName: string;
  stageId?: string | null;
  stageName?: string;
  subject: string;
  question: string;
  assignedToId?: string | null;
  assignedToName?: string;
}

export async function createRfi(draft: RfiDraft, actor: Actor): Promise<Rfi> {
  const ref = doc(collection(getDb(), RFIS));
  const payload = {
    projectId: draft.projectId,
    projectName: draft.projectName,
    stageId: draft.stageId ?? null,
    stageName: draft.stageName ?? "",
    subject: draft.subject,
    question: draft.question,
    status: (draft.assignedToId ? "ASSIGNED" : "OPEN") as RfiStatus,
    raisedById: actor.uid,
    raisedByName: actor.name,
    assignedToId: draft.assignedToId ?? null,
    assignedToName: draft.assignedToName ?? "",
    responses: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "RFI", entityId: ref.id, entityLabel: draft.subject, action: "CREATE",
    message: `Raised RFI: ${draft.subject}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Rfi, "id">) };
}

export async function respondToRfi(rfi: Rfi, message: string, actor: Actor, closeIt = false): Promise<void> {
  await updateDoc(doc(getDb(), RFIS, rfi.id), {
    responses: arrayUnion({ byId: actor.uid, byName: actor.name, message, at: Timestamp.now() }),
    status: (closeIt ? "CLOSED" : "CLARIFIED") as RfiStatus,
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "RFI", entityId: rfi.id, entityLabel: rfi.subject, action: "UPDATE",
    message: `Responded to RFI: ${rfi.subject}`, actor, projectId: rfi.projectId,
  });
}

export async function updateRfiStatus(rfi: Rfi, status: RfiStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), RFIS, rfi.id), { status, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "RFI", entityId: rfi.id, entityLabel: rfi.subject, action: "STATUS_CHANGE",
    message: `Marked RFI ${rfi.subject} ${status}`, actor, projectId: rfi.projectId,
  });
}
