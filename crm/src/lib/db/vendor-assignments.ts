"use client";

/**
 * Vendor Assignments — a scope of work handed to a vendor (or one of its
 * own sub-vendors, see Vendor.parentVendorId) for a project or any of its
 * sub-projects. Carries its own milestones, payment terms, penalty clause
 * and timeline, and can optionally point at the Quotation/PO/PI/BOQ that
 * actually bills/procures it — but none of those are required, since an
 * assignment can exist purely as the contractual scope before paperwork
 * catches up.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { AssignmentStatus, MilestoneStatus } from "../constants";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, AssignmentMilestone, VendorAssignment } from "../types";
import { buildSearchTokens } from "../utils";
import { logChangeSafe } from "./change-log";

export const VENDOR_ASSIGNMENTS = "vendorAssignments";

function mapAssignment(id: string, data: Record<string, unknown>): VendorAssignment {
  return { id, ...(data as Omit<VendorAssignment, "id">) };
}

async function nextAssignmentNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "vendorAssignments");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-WA-${String(next).padStart(5, "0")}`;
  });
}

export interface MilestoneDraft {
  name: string;
  dueDate?: Date | null;
  amount?: number;
  notes?: string;
}

function draftMilestone(m: MilestoneDraft): AssignmentMilestone {
  return {
    id: crypto.randomUUID(),
    name: m.name,
    dueDate: m.dueDate ? Timestamp.fromDate(m.dueDate) : null,
    amount: m.amount ?? undefined,
    status: "PENDING",
    completedAt: null,
    notes: m.notes ?? "",
  };
}

export interface VendorAssignmentDraft {
  vendorId: string;
  vendorName: string;
  parentVendorId?: string | null;
  parentVendorName?: string | null;
  projectId: string;
  projectName: string;
  title: string;
  scope?: string;
  contractAmount: number;
  paymentTerms?: string;
  penaltyClause?: string;
  startDate?: Date | null;
  deadline?: Date | null;
  milestones: MilestoneDraft[];
  linkedQuotationId?: string | null;
  linkedQuotationNo?: string | null;
  linkedPoId?: string | null;
  linkedPoNo?: string | null;
  linkedPiId?: string | null;
  linkedPiNo?: string | null;
  linkedBoqId?: string | null;
  linkedBoqNo?: string | null;
  notes?: string;
}

export async function createVendorAssignment(draft: VendorAssignmentDraft, actor: Actor): Promise<{ id: string; assignmentNo: string }> {
  const assignmentNo = await nextAssignmentNo();
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), VENDOR_ASSIGNMENTS));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      assignmentNo,
      vendorId: draft.vendorId,
      vendorName: draft.vendorName,
      parentVendorId: draft.parentVendorId ?? null,
      parentVendorName: draft.parentVendorName ?? null,
      projectId: draft.projectId,
      projectName: draft.projectName,
      title: draft.title,
      scope: draft.scope ?? "",
      status: "DRAFT" as AssignmentStatus,
      contractAmount: draft.contractAmount,
      paymentTerms: draft.paymentTerms ?? "",
      penaltyClause: draft.penaltyClause ?? "",
      startDate: draft.startDate ? Timestamp.fromDate(draft.startDate) : null,
      deadline: draft.deadline ? Timestamp.fromDate(draft.deadline) : null,
      milestones: draft.milestones.map(draftMilestone),
      linkedQuotationId: draft.linkedQuotationId ?? null,
      linkedQuotationNo: draft.linkedQuotationNo ?? null,
      linkedPoId: draft.linkedPoId ?? null,
      linkedPoNo: draft.linkedPoNo ?? null,
      linkedPiId: draft.linkedPiId ?? null,
      linkedPiNo: draft.linkedPiNo ?? null,
      linkedBoqId: draft.linkedBoqId ?? null,
      linkedBoqNo: draft.linkedBoqNo ?? null,
      notes: draft.notes ?? "",
      orgId,
      deletedAt: null,
      deletedBy: null,
      search: buildSearchTokens(assignmentNo, draft.title, draft.vendorName, draft.projectName),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
    });
  });

  logChangeSafe({
    entityType: "VENDOR_ASSIGNMENT", entityId: ref.id, entityLabel: `${assignmentNo} — ${draft.title}`, action: "CREATE", actor,
  });
  return { id: ref.id, assignmentNo };
}

export type VendorAssignmentPatch = Partial<Omit<VendorAssignmentDraft, "vendorId" | "vendorName" | "parentVendorId" | "parentVendorName">>;

export async function updateVendorAssignment(assignment: VendorAssignment, patch: VendorAssignmentPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.projectId !== undefined) update.projectId = patch.projectId;
  if (patch.projectName !== undefined) update.projectName = patch.projectName;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.scope !== undefined) update.scope = patch.scope;
  if (patch.contractAmount !== undefined) update.contractAmount = patch.contractAmount;
  if (patch.paymentTerms !== undefined) update.paymentTerms = patch.paymentTerms;
  if (patch.penaltyClause !== undefined) update.penaltyClause = patch.penaltyClause;
  if (patch.startDate !== undefined) update.startDate = patch.startDate ? Timestamp.fromDate(patch.startDate) : null;
  if (patch.deadline !== undefined) update.deadline = patch.deadline ? Timestamp.fromDate(patch.deadline) : null;
  if (patch.linkedQuotationId !== undefined) { update.linkedQuotationId = patch.linkedQuotationId; update.linkedQuotationNo = patch.linkedQuotationNo ?? null; }
  if (patch.linkedPoId !== undefined) { update.linkedPoId = patch.linkedPoId; update.linkedPoNo = patch.linkedPoNo ?? null; }
  if (patch.linkedPiId !== undefined) { update.linkedPiId = patch.linkedPiId; update.linkedPiNo = patch.linkedPiNo ?? null; }
  if (patch.linkedBoqId !== undefined) { update.linkedBoqId = patch.linkedBoqId; update.linkedBoqNo = patch.linkedBoqNo ?? null; }
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.title !== undefined || patch.projectName !== undefined) {
    update.search = buildSearchTokens(assignment.assignmentNo, patch.title ?? assignment.title, assignment.vendorName, patch.projectName ?? assignment.projectName);
  }

  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), update);
  logChangeSafe({
    entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: `${assignment.assignmentNo} — ${patch.title ?? assignment.title}`, action: "UPDATE", actor,
  });
}

export async function updateAssignmentStatus(assignment: VendorAssignment, status: AssignmentStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), { status, updatedAt: serverTimestamp() });
  logChangeSafe({
    entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: assignment.assignmentNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: assignment.status, to: status }],
  });
}

export async function addMilestone(assignment: VendorAssignment, draft: MilestoneDraft, actor: Actor): Promise<void> {
  const milestones = [...assignment.milestones, draftMilestone(draft)];
  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), { milestones, updatedAt: serverTimestamp() });
  logChangeSafe({
    entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: assignment.assignmentNo, action: "UPDATE", actor,
    changes: [{ field: "milestones", to: `added "${draft.name}"` }],
  });
}

export async function updateMilestoneStatus(
  assignment: VendorAssignment, milestoneId: string, status: MilestoneStatus, actor: Actor,
): Promise<void> {
  const milestones = assignment.milestones.map((m) =>
    m.id === milestoneId ? { ...m, status, completedAt: status === "COMPLETED" ? Timestamp.now() : m.completedAt } : m);
  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), { milestones, updatedAt: serverTimestamp() });
  logChangeSafe({
    entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: assignment.assignmentNo, action: "UPDATE", actor,
    changes: [{ field: `milestone:${milestoneId}`, to: status }],
  });
}

export async function removeMilestone(assignment: VendorAssignment, milestoneId: string, actor: Actor): Promise<void> {
  const milestones = assignment.milestones.filter((m) => m.id !== milestoneId);
  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), { milestones, updatedAt: serverTimestamp() });
  logChangeSafe({ entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: assignment.assignmentNo, action: "UPDATE", actor });
}

export async function trashVendorAssignment(assignment: VendorAssignment, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id), {
    deletedAt: serverTimestamp(), deletedBy: actor, updatedAt: serverTimestamp(),
  });
  logChangeSafe({ entityType: "VENDOR_ASSIGNMENT", entityId: assignment.id, entityLabel: assignment.assignmentNo, action: "DELETE", actor });
}

export async function deleteVendorAssignment(assignment: VendorAssignment): Promise<void> {
  await deleteDoc(doc(getDb(), VENDOR_ASSIGNMENTS, assignment.id));
}

export interface VendorAssignmentFilters {
  vendorId?: string;
  projectId?: string;
  status?: AssignmentStatus;
  max?: number;
}

export function subscribeVendorAssignments(
  filters: VendorAssignmentFilters,
  cb: (rows: VendorAssignment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    const constraints = [
      where("orgId", "==", orgId),
      ...(filters.vendorId ? [where("vendorId", "==", filters.vendorId)] : []),
      ...(filters.projectId ? [where("projectId", "==", filters.projectId)] : []),
      ...(filters.status ? [where("status", "==", filters.status)] : []),
    ];
    unsubscribe = onSnapshot(
      query(collection(getDb(), VENDOR_ASSIGNMENTS), ...constraints, orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapAssignment(d.id, d.data())).filter((a) => !a.deletedAt)),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeVendorAssignment(id: string, cb: (row: VendorAssignment | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), VENDOR_ASSIGNMENTS, id),
    (snap) => cb(snap.exists() ? mapAssignment(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
