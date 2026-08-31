"use client";

import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import { getDb, getBucket } from "../firebase/client";
import type { Actor, StageProgressPhoto } from "../types";
import { logActivitySafe } from "./activity";

export const STAGE_PHOTOS = "stagePhotos";

function mapPhoto(id: string, data: Record<string, unknown>): StageProgressPhoto {
  return { id, ...(data as Omit<StageProgressPhoto, "id">) };
}

export function subscribeStagePhotosForProject(projectId: string, cb: (rows: StageProgressPhoto[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), STAGE_PHOTOS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapPhoto(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Uploads a stage progress photo to Storage and records name/details against it in Firestore. */
export async function uploadStagePhoto(params: {
  file: File;
  projectId: string;
  projectName: string;
  stageId: string;
  stageName: string;
  title: string;
  details?: string;
  actor: Actor;
}): Promise<StageProgressPhoto> {
  const path = `nakjm/${params.projectId}/stage-photos/${Date.now()}-${params.file.name}`;
  const sRef = storageRef(getBucket(), path);
  await uploadBytes(sRef, params.file, { contentType: params.file.type });
  const photoUrl = await getDownloadURL(sRef);

  const ref = doc(collection(getDb(), STAGE_PHOTOS));
  const payload = {
    projectId: params.projectId,
    projectName: params.projectName,
    stageId: params.stageId,
    stageName: params.stageName,
    title: params.title,
    details: params.details ?? "",
    photoUrl,
    storagePath: path,
    mimeType: params.file.type,
    uploadedBy: params.actor,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "DOCUMENT", entityId: ref.id, entityLabel: params.title, action: "CREATE",
    message: `${params.actor.name} added photo "${params.title}" to stage ${params.stageName}`, actor: params.actor, projectId: params.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<StageProgressPhoto, "id">) };
}

export async function deleteStagePhoto(photo: StageProgressPhoto, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), STAGE_PHOTOS, photo.id));
  try {
    await deleteObject(storageRef(getBucket(), photo.storagePath));
  } catch {
    // Storage object may already be gone -- Firestore record removal is what matters.
  }
  logActivitySafe({
    entityType: "DOCUMENT", entityId: photo.id, entityLabel: photo.title, action: "DELETE",
    message: `Deleted photo "${photo.title}" from stage ${photo.stageName}`, actor, projectId: photo.projectId,
  });
}
