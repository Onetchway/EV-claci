"use client";

/**
 * Diagnostic knowledge base — a searchable OEM error-code reference NOC/
 * support staff can consult while triaging a ticket, entirely separate from
 * the live fault-ticket pipeline (tickets.ts / ocpp-server/tickets.ts).
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, DiagnosticCode, DiagnosticSeverity } from "../types";

export const DIAGNOSTIC_CODES = "diagnosticCodes";

function mapCode(id: string, data: Record<string, unknown>): DiagnosticCode {
  return { id, ...(data as Omit<DiagnosticCode, "id">) };
}

export function subscribeDiagnosticCodes(
  cb: (rows: DiagnosticCode[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), DIAGNOSTIC_CODES), orderBy("code", "asc")),
    (snap) => cb(snap.docs.map((d) => mapCode(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type DiagnosticCodeDraft = Pick<
  DiagnosticCode, "code" | "vendor" | "title" | "description" | "likelyCause" | "recommendedAction" | "severity"
>;

export async function addDiagnosticCode(draft: DiagnosticCodeDraft, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), DIAGNOSTIC_CODES), {
    ...draft,
    code: draft.code.trim(),
    vendor: draft.vendor.trim(),
    title: draft.title.trim(),
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function updateDiagnosticCode(id: string, draft: DiagnosticCodeDraft): Promise<void> {
  await updateDoc(doc(getDb(), DIAGNOSTIC_CODES, id), {
    ...draft,
    code: draft.code.trim(),
    vendor: draft.vendor.trim(),
    title: draft.title.trim(),
  });
}

export async function deleteDiagnosticCode(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), DIAGNOSTIC_CODES, id));
}

export const DIAGNOSTIC_SEVERITY_LABEL: Record<DiagnosticSeverity, string> = {
  INFO: "Info",
  WARNING: "Warning",
  CRITICAL: "Critical",
};
