"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp,
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

/** Every active user holding any of the given roles (checks both the primary `role` and the full `roles` list) — who to notify when something needs a role-gated review, e.g. verifying a payment or a KYC document. */
export async function getUsersByRole(roles: Role[]): Promise<AppUser[]> {
  const snap = await getDocs(collection(getDb(), USERS));
  return snap.docs
    .map((d) => mapUser(d.id, d.data()))
    .filter((u) => u.active !== false && (roles.includes(u.role) || (u.roles ?? []).some((r) => roles.includes(r))));
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

/** Assignable agents — what the "reassign lead" picker is populated from. */
export function subscribeActiveAgents(
  cb: (rows: AppUser[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), USERS), where("active", "==", true)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => mapUser(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    (err) => onError?.(err as Error),
  );
}

/** Called on every sign-in so the directory reflects reality. */
export async function touchLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(getDb(), USERS, uid), { lastLoginAt: serverTimestamp() });
  } catch {
    // A profile that does not exist yet is handled by the bootstrap path.
  }
}

/**
 * First-run bootstrap: the very first account to sign in becomes SUPER_ADMIN.
 * Afterwards, profiles are only created through the admin API so roles can't
 * be self-assigned.
 */
export async function ensureProfile(params: {
  uid: string;
  email: string;
  name: string;
  photoURL?: string | null;
  role?: Role;
}): Promise<AppUser> {
  const existing = await getUser(params.uid);
  if (existing) return existing;

  const payload = {
    uid: params.uid,
    email: params.email,
    name: params.name || params.email.split("@")[0],
    role: params.role ?? ("AGENT" as Role),
    phone: "",
    managerId: null,
    region: null,
    active: true,
    photoURL: params.photoURL ?? null,
    createdAt: serverTimestamp(),
    createdBy: null,
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(doc(getDb(), USERS, params.uid), payload);
  return { id: params.uid, ...(payload as unknown as Omit<AppUser, "id">) };
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<AppUser, "name" | "phone" | "region" | "managerId">>,
): Promise<void> {
  await updateDoc(doc(getDb(), USERS, uid), patch);
}
