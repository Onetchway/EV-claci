"use client";

import {
  collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";

import type { Role } from "../constants";
import { getDb } from "../firebase/client";
import type { AppUser } from "../types";

export const USERS = "users";

function mapUser(id: string, data: Record<string, unknown>): AppUser {
  return { id, ...(data as Omit<AppUser, "id">) };
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), USERS, uid));
  return snap.exists() ? mapUser(snap.id, snap.data()) : null;
}

export function subscribeUsers(
  cb: (rows: AppUser[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), USERS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapUser(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeActiveUsers(
  cb: (rows: AppUser[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), USERS), where("active", "==", true)),
    (snap) =>
      cb(snap.docs.map((d) => mapUser(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))),
    (err) => onError?.(err as Error),
  );
}

export async function touchLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(getDb(), USERS, uid), { lastLoginAt: serverTimestamp() });
  } catch {
    // A profile that does not exist yet is handled by the bootstrap path.
  }
}

/**
 * Any signed-in Workspace account gets a profile the first time it appears,
 * at the lowest privilege level (VIEWER, read-only everywhere). An admin
 * then promotes them to the right role from Team & Roles — roles can't be
 * self-assigned above that floor.
 */
export async function ensureProfile(params: {
  uid: string;
  email: string;
  name: string;
  photoURL?: string | null;
}): Promise<AppUser> {
  const existing = await getUser(params.uid);
  if (existing) return existing;

  const payload = {
    uid: params.uid,
    email: params.email,
    name: params.name || params.email.split("@")[0],
    role: "VIEWER" as Role,
    phone: "",
    active: true,
    photoURL: params.photoURL ?? null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(doc(getDb(), USERS, params.uid), payload);
  return { id: params.uid, ...(payload as unknown as Omit<AppUser, "id">) };
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<AppUser, "name" | "phone">>,
): Promise<void> {
  await updateDoc(doc(getDb(), USERS, uid), patch);
}
