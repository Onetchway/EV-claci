"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { StageStatus, SubVendorContractStatus, SubVendorPaymentStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, SubVendorContract } from "../types";
import { logActivitySafe } from "./activity";

/** Editable form of a stage -- dates as plain JS Date (or unset), converted to Firestore Timestamps on save. */
export interface SubVendorStageInput {
  name: string;
  status: StageStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  amount?: number;
  notes?: string;
}

/** Editable form of a payment term. */
export interface SubVendorPaymentTermInput {
  milestone: string;
  percent?: number;
  amount?: number;
  status: SubVendorPaymentStatus;
}

export const SUB_VENDOR_CONTRACTS = "subVendorContracts";

function mapContract(id: string, data: Record<string, unknown>): SubVendorContract {
  return { id, ...(data as Omit<SubVendorContract, "id">) };
}

/** NKJM-SV-00001, allocated transactionally so two office staff can't collide. */
async function nextContractNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "subVendorContracts");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-SVC-${String(seq).padStart(5, "0")}`;
}

export function subscribeSubVendorContracts(cb: (rows: SubVendorContract[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SUB_VENDOR_CONTRACTS)),
    (snap) => cb(snap.docs.map((d) => mapContract(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSubVendorContractsForProject(projectId: string, cb: (rows: SubVendorContract[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SUB_VENDOR_CONTRACTS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapContract(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSubVendorContract(id: string, cb: (c: SubVendorContract | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), SUB_VENDOR_CONTRACTS, id),
    (snap) => cb(snap.exists() ? mapContract(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getSubVendorContract(id: string): Promise<SubVendorContract | null> {
  const snap = await getDoc(doc(getDb(), SUB_VENDOR_CONTRACTS, id));
  return snap.exists() ? mapContract(snap.id, snap.data()) : null;
}

export interface SubVendorContractDraft {
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  scopeOfWork?: string;
  contractValue?: number;
  status?: SubVendorContractStatus;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  stages?: SubVendorStageInput[];
  paymentTerms?: SubVendorPaymentTermInput[];
  penaltyClause?: string;
  penaltyAmount?: number;
  penaltyTimelineDays?: number;
  terms?: string;
  notes?: string;
}

function stagesForSave(stages: SubVendorStageInput[]) {
  return stages.map((s) => ({
    name: s.name, status: s.status, amount: s.amount ?? 0, notes: s.notes ?? "",
    startDate: s.startDate ? Timestamp.fromDate(s.startDate) : null,
    endDate: s.endDate ? Timestamp.fromDate(s.endDate) : null,
  }));
}

export async function createSubVendorContract(draft: SubVendorContractDraft, actor: Actor): Promise<SubVendorContract> {
  const contractNo = await nextContractNo();
  const ref = doc(collection(getDb(), SUB_VENDOR_CONTRACTS));
  const payload = {
    contractNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    vendorId: draft.vendorId,
    vendorName: draft.vendorName,
    scopeOfWork: draft.scopeOfWork ?? "",
    contractValue: draft.contractValue ?? 0,
    status: draft.status ?? "DRAFT",
    startDate: draft.startDate ? Timestamp.fromDate(draft.startDate) : null,
    targetEndDate: draft.targetEndDate ? Timestamp.fromDate(draft.targetEndDate) : null,
    stages: stagesForSave(draft.stages ?? []),
    paymentTerms: draft.paymentTerms ?? [],
    penaltyClause: draft.penaltyClause ?? "",
    penaltyAmount: draft.penaltyAmount ?? 0,
    penaltyTimelineDays: draft.penaltyTimelineDays ?? 0,
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "SUB_VENDOR_CONTRACT", entityId: ref.id, entityLabel: `${contractNo} — ${draft.vendorName}`, action: "CREATE",
    message: `Created sub-vendor contract ${contractNo} with ${draft.vendorName}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<SubVendorContract, "id">) };
}

export type SubVendorContractPatch = Partial<Omit<SubVendorContractDraft, "projectId" | "projectName" | "vendorId" | "vendorName">>;

export async function updateSubVendorContract(contract: SubVendorContract, patch: SubVendorContractPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp(), updatedBy: actor };
  if (patch.scopeOfWork !== undefined) update.scopeOfWork = patch.scopeOfWork;
  if (patch.contractValue !== undefined) update.contractValue = patch.contractValue;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.stages !== undefined) update.stages = stagesForSave(patch.stages);
  if (patch.paymentTerms !== undefined) update.paymentTerms = patch.paymentTerms;
  if (patch.penaltyClause !== undefined) update.penaltyClause = patch.penaltyClause;
  if (patch.penaltyAmount !== undefined) update.penaltyAmount = patch.penaltyAmount;
  if (patch.penaltyTimelineDays !== undefined) update.penaltyTimelineDays = patch.penaltyTimelineDays;
  if (patch.terms !== undefined) update.terms = patch.terms;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.startDate !== undefined) update.startDate = patch.startDate ? Timestamp.fromDate(patch.startDate) : null;
  if (patch.targetEndDate !== undefined) update.targetEndDate = patch.targetEndDate ? Timestamp.fromDate(patch.targetEndDate) : null;
  await updateDoc(doc(getDb(), SUB_VENDOR_CONTRACTS, contract.id), update);
  logActivitySafe({
    entityType: "SUB_VENDOR_CONTRACT", entityId: contract.id, entityLabel: contract.contractNo,
    action: patch.status && patch.status !== contract.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== contract.status ? `status: ${contract.status} → ${patch.status}` : `Edited sub-vendor contract ${contract.contractNo}`,
    actor, projectId: contract.projectId,
  });
}

export async function deleteSubVendorContract(contract: SubVendorContract, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), SUB_VENDOR_CONTRACTS, contract.id));
  logActivitySafe({
    entityType: "SUB_VENDOR_CONTRACT", entityId: contract.id, entityLabel: contract.contractNo, action: "DELETE",
    message: `Deleted sub-vendor contract ${contract.contractNo}`, actor, projectId: contract.projectId,
  });
}
