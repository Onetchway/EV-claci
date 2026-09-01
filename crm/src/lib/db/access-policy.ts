"use client";

/**
 * The editable role-based page-access policy — a single settings doc a
 * Super Admin can adjust from Team & Roles, overriding the hardcoded
 * DEFAULT_PAGE_ACCESS in lib/page-access.ts. Missing entries fall back to
 * the default, so this doc never needs to be fully populated: it only
 * needs to store the paths an admin has actually changed.
 */

import { doc, onSnapshot, setDoc } from "firebase/firestore";

import type { Role } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor } from "../types";

const DOC_PATH = ["settings", "roleAccessPolicy"] as const;

export function subscribeRoleAccessPolicy(
  cb: (policy: Record<string, Role[]> | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), ...DOC_PATH),
    (snap) => cb(snap.exists() ? ((snap.data().pages as Record<string, Role[]> | undefined) ?? null) : null),
    (err) => onError?.(err as Error),
  );
}

export async function setPageRoles(path: string, roles: Role[], actor: Actor): Promise<void> {
  await setDoc(
    doc(getDb(), ...DOC_PATH),
    { pages: { [path]: roles }, updatedAt: new Date(), updatedBy: actor },
    { merge: true },
  );
}
