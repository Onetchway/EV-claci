"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc } from "firebase/firestore";

import { STAGE_TEMPLATES, type ProjectType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor } from "../types";
import { logActivitySafe } from "./activity";

export const PROJECT_TEMPLATES = "projectTemplates";

export interface ProjectTemplate {
  id: ProjectType;
  stages: string[];
  updatedAt?: unknown;
}

/**
 * Admin-configurable stage templates per project type. One doc per project
 * type, keyed by the type itself. Falls back to the built-in STAGE_TEMPLATES
 * constant for any type that hasn't been customised yet, so this collection
 * only needs to hold the types an admin has actually edited.
 */
export function subscribeProjectTemplates(cb: (templates: Record<ProjectType, string[]>) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PROJECT_TEMPLATES)),
    (snap) => {
      const merged = { ...STAGE_TEMPLATES } as Record<ProjectType, string[]>;
      for (const d of snap.docs) {
        const stages = d.data().stages as string[] | undefined;
        if (stages?.length) merged[d.id as ProjectType] = stages;
      }
      cb(merged);
    },
    (err) => onError?.(err as Error),
  );
}

export async function saveProjectTemplate(projectType: ProjectType, stages: string[], actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), PROJECT_TEMPLATES, projectType), { stages, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "PROJECT", entityId: projectType, entityLabel: `${projectType} template`, action: "UPDATE",
    message: `Updated the ${projectType.replace(/_/g, " ")} stage template`, actor,
  });
}
