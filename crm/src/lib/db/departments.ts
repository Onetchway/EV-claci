"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Department } from "../types";

export const DEPARTMENTS = "departments";

function mapDepartment(id: string, data: Record<string, unknown>): Department {
  return { id, ...(data as Omit<Department, "id">) };
}

// Mutations (create/rename/delete) go through /api/departments — see that
// route's comment for why: it reads the caller's role straight from
// Firestore via the Admin SDK, rather than depending on the ID token's role
// custom claim the way a direct client write gated by the `isAdmin()`
// Firestore rule would.
export function subscribeDepartments(
  cb: (rows: Department[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), DEPARTMENTS), orderBy("name")),
    (snap) => cb(snap.docs.map((d) => mapDepartment(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
