"use client";

import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { GST_RATE } from "../catalog";
import type { PaymentMilestone, PaymentMode, PaymentStatus } from "../constants";
import { MILESTONE_LABEL } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import { buildQuote } from "../pricing";
import type { Actor, Lead, Payment, PaymentAttachment } from "../types";
import { formatINR } from "../utils";
import { logActivitySafe } from "./activity";
import { LEADS, refreshPaymentRollup } from "./leads";
import { accruePartnerCommissionSafe } from "./partners";

const sub = (leadId: string) => collection(getDb(), LEADS, leadId, "payments");

export function subscribePayments(
  leadId: string,
  cb: (rows: Payment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(sub(leadId), orderBy("createdAt", "asc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, leadId, ...(d.data() as Omit<Payment, "id" | "leadId">) }))),
    (err) => onError?.(err as Error),
  );
}

export interface PaymentDraft {
  milestone: PaymentMilestone;
  /** Amount excluding GST — GST is derived from gstPct, never typed in directly. */
  baseAmount: number;
  /** GST rate as a fraction (0.05 = 5%). Defaults to GST_RATE — the charger rate, since most milestone payments are against charger hardware. */
  gstPct?: number;
  mode: PaymentMode;
  reference?: string;
  status: PaymentStatus;
  paidAt?: Date | null;
  dueAt?: Date | null;
  note?: string;
}

function amounts(baseAmount: number, gstPct: number = GST_RATE) {
  const base = Math.max(0, Math.round(baseAmount));
  const pct = Math.max(0, gstPct);
  const gst = Math.round(base * pct);
  return { baseAmount: base, gstPct: pct, gstAmount: gst, totalAmount: base + gst };
}

export async function addPayment(lead: Lead, draft: PaymentDraft, actor: Actor): Promise<void> {
  const money = amounts(draft.baseAmount, draft.gstPct);
  await addDoc(sub(lead.id), {
    ...money,
    milestone: draft.milestone,
    mode: draft.mode,
    reference: draft.reference ?? "",
    status: draft.status,
    paidAt: draft.paidAt ? Timestamp.fromDate(draft.paidAt) : null,
    dueAt: draft.dueAt ? Timestamp.fromDate(draft.dueAt) : null,
    note: draft.note ?? "",
    receiptDocId: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    verifiedBy: draft.status === "VERIFIED" ? actor : null,
  });

  await refreshPaymentRollup(lead.id, actor);
  accruePartnerCommissionSafe(lead.id);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PAYMENT_ADDED",
    message: `${MILESTONE_LABEL[draft.milestone]} — ${formatINR(money.totalAmount)} recorded as ${draft.status.toLowerCase()} via ${draft.mode}`,
    actor,
  });
}

export async function updatePayment(
  lead: Lead,
  payment: Payment,
  patch: Partial<PaymentDraft>,
  actor: Actor,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };

  if (patch.baseAmount !== undefined || patch.gstPct !== undefined) {
    Object.assign(update, amounts(patch.baseAmount ?? payment.baseAmount, patch.gstPct ?? payment.gstPct));
  }
  if (patch.milestone !== undefined) update.milestone = patch.milestone;
  if (patch.mode !== undefined) update.mode = patch.mode;
  if (patch.reference !== undefined) update.reference = patch.reference;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.paidAt !== undefined) update.paidAt = patch.paidAt ? Timestamp.fromDate(patch.paidAt) : null;
  if (patch.dueAt !== undefined) update.dueAt = patch.dueAt ? Timestamp.fromDate(patch.dueAt) : null;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === "VERIFIED") update.verifiedBy = actor;
  }

  await updateDoc(doc(getDb(), LEADS, lead.id, "payments", payment.id), update);
  await refreshPaymentRollup(lead.id, actor);
  accruePartnerCommissionSafe(lead.id);

  const bits: string[] = [];
  if (patch.status && patch.status !== payment.status) bits.push(`status ${payment.status} → ${patch.status}`);
  if (patch.baseAmount !== undefined && patch.baseAmount !== payment.baseAmount) {
    bits.push(`amount ${formatINR(payment.totalAmount)} → ${formatINR(amounts(patch.baseAmount).totalAmount)}`);
  }

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PAYMENT_UPDATED",
    message: `${MILESTONE_LABEL[patch.milestone ?? payment.milestone]} payment updated${bits.length ? ` — ${bits.join(", ")}` : ""}`,
    actor,
  });
}

export async function deletePayment(lead: Lead, payment: Payment, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), LEADS, lead.id, "payments", payment.id));
  await refreshPaymentRollup(lead.id, actor);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PAYMENT_DELETED",
    message: `Deleted ${MILESTONE_LABEL[payment.milestone]} entry of ${formatINR(payment.totalAmount)}`,
    actor,
  });
}

export const MAX_PAYMENT_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const PAYMENT_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
];

export function validatePaymentAttachment(file: File): string | null {
  if (file.size > MAX_PAYMENT_ATTACHMENT_BYTES) return "File is larger than 15 MB.";
  if (file.size === 0) return "File is empty.";
  if (!PAYMENT_ATTACHMENT_TYPES.includes(file.type)) return "Only PDF, JPG, PNG, WEBP or HEIC files are accepted.";
  return null;
}

/** Attaches a proof-of-payment file (receipt, screenshot, UTR slip) to an existing payment entry. */
export async function uploadPaymentAttachment(
  lead: Lead,
  payment: Payment,
  file: File,
  actor: Actor,
  onProgress?: (pct: number) => void,
): Promise<PaymentAttachment> {
  const problem = validatePaymentAttachment(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `leads/${lead.id}/payments/${payment.id}_${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { leadId: lead.id, uploadedBy: actor.uid },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);
  const attachment: PaymentAttachment = {
    fileName: file.name,
    storagePath,
    url,
    contentType: file.type,
    size: file.size,
    uploadedAt: Timestamp.now(),
    uploadedBy: actor,
  };

  await updateDoc(doc(getDb(), LEADS, lead.id, "payments", payment.id), {
    attachments: arrayUnion(attachment),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PAYMENT_UPDATED",
    message: `Attached ${file.name} to ${MILESTONE_LABEL[payment.milestone]} payment`,
    actor,
  });

  return attachment;
}

export async function deletePaymentAttachment(
  lead: Lead,
  payment: Payment,
  attachment: PaymentAttachment,
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id, "payments", payment.id), {
    attachments: arrayRemove(attachment),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  try {
    await deleteObject(ref(getBucket(), attachment.storagePath));
  } catch (err) {
    console.error("[payments] storage object could not be removed", err);
  }

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PAYMENT_UPDATED",
    message: `Removed attachment ${attachment.fileName} from ${MILESTONE_LABEL[payment.milestone]} payment`,
    actor,
  });
}

export interface MilestoneProgress {
  key: PaymentMilestone;
  label: string;
  /** Expected total incl. GST for this milestone, from the lead's quote. */
  planned: number;
  received: number;
  balance: number;
  pct: number;
}

export interface PaymentSummary {
  planned: number;
  received: number;
  pending: number;
  balance: number;
  collectedPct: number;
  milestones: MilestoneProgress[];
}

/** Reconciles the ledger against the quote's three-stage schedule. */
export function summarisePayments(lead: Lead, payments: Payment[]): PaymentSummary {
  const quote = buildQuote(lead.config ?? [], { discount: lead.discount ?? 0 });
  const planned = quote.grandTotal;

  const settled = (p: Payment) => p.status === "RECEIVED" || p.status === "VERIFIED";
  const received = payments.filter(settled).reduce((a, p) => a + p.totalAmount, 0);
  const pending = payments.filter((p) => p.status === "PENDING").reduce((a, p) => a + p.totalAmount, 0);

  const milestones: MilestoneProgress[] = quote.milestones.map((m) => {
    const got = payments
      .filter((p) => p.milestone === m.key && settled(p))
      .reduce((a, p) => a + p.totalAmount, 0);
    return {
      key: m.key,
      label: m.label,
      planned: m.total,
      received: got,
      balance: Math.max(0, m.total - got),
      pct: m.total > 0 ? Math.min(100, Math.round((got / m.total) * 100)) : 0,
    };
  });

  const adHoc = payments.filter((p) => p.milestone === "OTHER" && settled(p));
  if (adHoc.length) {
    const got = adHoc.reduce((a, p) => a + p.totalAmount, 0);
    milestones.push({
      key: "OTHER", label: MILESTONE_LABEL.OTHER, planned: got, received: got, balance: 0, pct: 100,
    });
  }

  return {
    planned,
    received,
    pending,
    balance: Math.max(0, planned - received),
    collectedPct: planned > 0 ? Math.min(100, Math.round((received / planned) * 100)) : 0,
    milestones,
  };
}
