"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import type { ExpenseCategory } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import type { Actor, ExpenseLineItem, ExpenseReport } from "../types";
import { logActivitySafe } from "./activity";

export const EXPENSE_REPORTS = "expenseReports";

function mapReport(id: string, data: Record<string, unknown>): ExpenseReport {
  return { id, ...(data as Omit<ExpenseReport, "id">) };
}

/** NKJM-EXP-00001, allocated transactionally so two people submitting at once can't collide. */
async function nextReportNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "expenseReports");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-EXP-${String(seq).padStart(5, "0")}`;
}

export async function uploadExpenseReceipt(file: File, uid: string): Promise<{ url: string; path: string }> {
  const path = `nakjm/expenses/${uid}/${Date.now()}-${file.name}`;
  const sRef = storageRef(getBucket(), path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);
  return { url, path };
}

export function subscribeMyExpenseReports(uid: string, cb: (rows: ExpenseReport[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), EXPENSE_REPORTS), where("uid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** For managers, finance and admins -- every employee's expense reports. */
export function subscribeAllExpenseReports(cb: (rows: ExpenseReport[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), EXPENSE_REPORTS)),
    (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeExpenseReport(id: string, cb: (r: ExpenseReport | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), EXPENSE_REPORTS, id),
    (snap) => cb(snap.exists() ? mapReport(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getExpenseReport(id: string): Promise<ExpenseReport | null> {
  const snap = await getDoc(doc(getDb(), EXPENSE_REPORTS, id));
  return snap.exists() ? mapReport(snap.id, snap.data()) : null;
}

/** Editable form of a line item -- date as plain JS Date, converted to a Timestamp on save. */
export interface ExpenseLineItemInput {
  category: ExpenseCategory;
  date: Date | null;
  description?: string;
  distanceKm?: number;
  ratePerKm?: number;
  amount: number;
  receiptUrl?: string;
  receiptPath?: string;
}

function itemsForSave(items: ExpenseLineItemInput[]): Omit<ExpenseLineItem, never>[] {
  return items.map((it) => ({
    category: it.category,
    date: it.date ? Timestamp.fromDate(it.date) : null,
    description: it.description ?? "",
    distanceKm: it.distanceKm ?? 0,
    ratePerKm: it.ratePerKm ?? 0,
    amount: it.amount,
    receiptUrl: it.receiptUrl ?? "",
    receiptPath: it.receiptPath ?? "",
  })) as unknown as ExpenseLineItem[];
}

export interface ExpenseReportDraft {
  uid: string;
  userName: string;
  managerId?: string | null;
  managerName?: string | null;
  month: string;
  items: ExpenseLineItemInput[];
  notes?: string;
}

export async function createExpenseReport(draft: ExpenseReportDraft, actor: Actor): Promise<ExpenseReport> {
  const reportNo = await nextReportNo();
  const ref = doc(collection(getDb(), EXPENSE_REPORTS));
  const items = itemsForSave(draft.items);
  const payload = {
    reportNo,
    uid: draft.uid,
    userName: draft.userName,
    managerId: draft.managerId ?? null,
    managerName: draft.managerName ?? null,
    month: draft.month,
    items,
    totalAmount: items.reduce((s, it) => s + (it.amount || 0), 0),
    status: "DRAFT" as const,
    notes: draft.notes ?? "",
    submittedAt: null,
    managerDecisionBy: null,
    managerDecisionAt: null,
    managerNote: "",
    financeDecisionBy: null,
    financeDecisionAt: null,
    financeNote: "",
    paidAt: null,
    paidBy: null,
    paidReferenceNo: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: ref.id, entityLabel: `${reportNo} — ${draft.userName}`, action: "CREATE",
    message: `${draft.userName} started expense report ${reportNo} for ${draft.month}`, actor,
  });
  return { id: ref.id, ...(payload as unknown as Omit<ExpenseReport, "id">) };
}

export async function updateExpenseReport(report: ExpenseReport, patch: { items: ExpenseLineItemInput[]; notes?: string }, actor: Actor): Promise<void> {
  const items = itemsForSave(patch.items);
  await updateDoc(doc(getDb(), EXPENSE_REPORTS, report.id), {
    items,
    totalAmount: items.reduce((s, it) => s + (it.amount || 0), 0),
    notes: patch.notes ?? report.notes ?? "",
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "UPDATE",
    message: `Edited expense report ${report.reportNo}`, actor,
  });
}

export async function deleteExpenseReport(report: ExpenseReport, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), EXPENSE_REPORTS, report.id));
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "DELETE",
    message: `Deleted expense report ${report.reportNo}`, actor,
  });
}

/** Draft/rejected -> Submitted, moving it to the employee's manager for a decision. */
export async function submitExpenseReport(report: ExpenseReport, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), EXPENSE_REPORTS, report.id), {
    status: "SUBMITTED", submittedAt: serverTimestamp(),
    managerDecisionBy: null, managerDecisionAt: null, managerNote: "",
    financeDecisionBy: null, financeDecisionAt: null, financeNote: "",
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "STATUS_CHANGE",
    message: `status: ${report.status} → SUBMITTED`, actor,
  });
}

export async function decideExpenseReportAsManager(report: ExpenseReport, approve: boolean, actor: Actor, note?: string): Promise<void> {
  const status = approve ? "MANAGER_APPROVED" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_REPORTS, report.id), {
    status, managerDecisionBy: actor, managerDecisionAt: serverTimestamp(), managerNote: note ?? "",
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "STATUS_CHANGE",
    message: `status: ${report.status} → ${status}`, actor,
  });
}

export async function decideExpenseReportAsFinance(report: ExpenseReport, approve: boolean, actor: Actor, note?: string): Promise<void> {
  const status = approve ? "FINANCE_APPROVED" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_REPORTS, report.id), {
    status, financeDecisionBy: actor, financeDecisionAt: serverTimestamp(), financeNote: note ?? "",
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "STATUS_CHANGE",
    message: `status: ${report.status} → ${status}`, actor,
  });
}

export async function markExpenseReportPaid(report: ExpenseReport, referenceNo: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), EXPENSE_REPORTS, report.id), {
    status: "PAID", paidAt: serverTimestamp(), paidBy: actor, paidReferenceNo: referenceNo,
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "EXPENSE_REPORT", entityId: report.id, entityLabel: report.reportNo, action: "STATUS_CHANGE",
    message: `status: ${report.status} → PAID`, actor,
  });
}
