"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Department } from "../types";

export const DEPARTMENTS = "departments";

function mapDepartment(id: string, data: Record<string, unknown>): Department {
  return { id, ...(data as Omit<Department, "id">) };
}

export async function createDepartment(name: string, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), DEPARTMENTS), {
    name: name.trim(),
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return ref.id;
}

export async function renameDepartment(id: string, name: string): Promise<void> {
  await updateDoc(doc(getDb(), DEPARTMENTS, id), { name: name.trim() });
}

export async function deleteDepartment(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), DEPARTMENTS, id));
}

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
