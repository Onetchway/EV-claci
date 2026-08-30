"use client";

import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import type { DrawingDiscipline, DrawingStatus } from "../constants";
import { getDb, getBucket } from "../firebase/client";
import type { Actor, Drawing } from "../types";
import { logActivitySafe } from "./activity";

export const DRAWINGS = "drawings";

function mapDrawing(id: string, data: Record<string, unknown>): Drawing {
  return { id, ...(data as Omit<Drawing, "id">) };
}

export function subscribeDrawingsForProject(projectId: string, cb: (rows: Drawing[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), DRAWINGS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapDrawing(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/**
 * Uploads a new drawing revision. If other revisions already exist under the
 * same drawing number, they're marked SUPERSEDED (not deleted — the whole
 * point of a drawing register is that history is never lost).
 */
export async function uploadDrawing(
  params: {
    file: File;
    projectId: string;
    projectName: string;
    drawingNumber: string;
    title: string;
    discipline: DrawingDiscipline;
    revision: string;
    existingRevisionIds?: string[];
  },
  actor: Actor,
): Promise<Drawing> {
  const path = `nakjm/${params.projectId}/drawing-${Date.now()}-${params.file.name}`;
  const sRef = storageRef(getBucket(), path);
  await uploadBytes(sRef, params.file, { contentType: params.file.type });
  const downloadUrl = await getDownloadURL(sRef);

  const ref = doc(collection(getDb(), DRAWINGS));
  const payload = {
    projectId: params.projectId,
    projectName: params.projectName,
    drawingNumber: params.drawingNumber,
    title: params.title,
    discipline: params.discipline,
    revision: params.revision,
    status: "DRAFT" as DrawingStatus,
    fileName: params.file.name,
    storagePath: path,
    downloadUrl,
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    uploadedBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.existingRevisionIds?.length) {
    const batch = writeBatch(getDb());
    batch.set(ref, payload);
    for (const id of params.existingRevisionIds) {
      batch.update(doc(getDb(), DRAWINGS, id), { status: "SUPERSEDED", updatedAt: serverTimestamp() });
    }
    await batch.commit();
  } else {
    await setDoc(ref, payload);
  }

  logActivitySafe({
    entityType: "DRAWING", entityId: ref.id, entityLabel: `${params.drawingNumber} ${params.revision}`, action: "CREATE",
    message: `Uploaded drawing ${params.drawingNumber} ${params.revision}`, actor, projectId: params.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Drawing, "id">) };
}

export async function updateDrawingStatus(drawing: Drawing, status: DrawingStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), DRAWINGS, drawing.id), { status, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "DRAWING", entityId: drawing.id, entityLabel: `${drawing.drawingNumber} ${drawing.revision}`, action: "STATUS_CHANGE",
    message: `Marked drawing ${drawing.drawingNumber} ${drawing.revision} ${status}`, actor, projectId: drawing.projectId,
  });
}
