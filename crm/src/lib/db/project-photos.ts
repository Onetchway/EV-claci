"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import type { Workstream } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import type { Actor, Project, ProjectPhoto } from "../types";
import { logActivitySafe } from "./activity";
import { MAX_UPLOAD_BYTES } from "./documents";

const sub = (projectId: string) => collection(getDb(), "projects", projectId, "photos");

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"];

export function validatePhotoFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 15 MB.";
  if (file.size === 0) return "File is empty.";
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "Only PNG, JPG, WEBP or HEIC photos are accepted.";
  return null;
}

export function subscribeProjectPhotos(
  projectId: string,
  cb: (rows: ProjectPhoto[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(sub(projectId), orderBy("uploadedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, projectId, ...(d.data() as Omit<ProjectPhoto, "id" | "projectId">) }))),
    (err) => onError?.(err as Error),
  );
}

export async function uploadProjectPhoto(
  project: Project,
  file: File,
  opts: { caption?: string; workstream?: Workstream | null; onProgress?: (pct: number) => void },
  actor: Actor,
): Promise<ProjectPhoto> {
  const problem = validatePhotoFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `projects/${project.id}/photos/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { projectId: project.id, uploadedBy: actor.uid },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => opts.onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);

  const payload = {
    storagePath,
    url,
    contentType: file.type,
    size: file.size,
    caption: opts.caption ?? "",
    workstream: opts.workstream ?? null,
    uploadedAt: serverTimestamp(),
    uploadedBy: actor,
  };

  const created = await addDoc(sub(project.id), payload);

  if (project.sourceLeadId) {
    logActivitySafe({
      leadId: project.sourceLeadId,
      ownerId: project.managerId,
      leadCode: project.sourceLeadCode ?? project.code,
      leadName: project.client?.name,
      type: "DOCUMENT_UPLOADED",
      message: `Uploaded a site photo${opts.caption ? ` — ${opts.caption}` : ""}`,
      actor,
    });
  }

  return { id: created.id, projectId: project.id, ...(payload as unknown as Omit<ProjectPhoto, "id" | "projectId">) };
}

export async function deleteProjectPhoto(project: Project, photo: ProjectPhoto): Promise<void> {
  await deleteDoc(doc(getDb(), "projects", project.id, "photos", photo.id));
  try {
    await deleteObject(ref(getBucket(), photo.storagePath));
  } catch (err) {
    console.error("[project-photos] storage object could not be removed", err);
  }
}
