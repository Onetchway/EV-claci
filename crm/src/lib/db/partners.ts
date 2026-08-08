"use client";

/**
 * Channel partners — dealers, EPC contractors and referral partners who
 * originate leads, per the Livanto Channel Partner Program. A partner's tier
 * (Associate/Authorized/Elite) drives their commission rate; commission
 * itself accrues once a referred lead's station is fully paid, matching the
 * program's stated payout rule.
 */

import {
  collection, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import {
  PARTNER_TIER_RATE, PARTNER_TIER_THRESHOLD, type PartnerCategory,
  type PartnerTier,
} from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Partner, PartnerCommission } from "../types";
import { LEADS } from "./leads";

export const PARTNERS = "partners";
export const COMMISSIONS = "partnerCommissions";

function mapPartner(id: string, data: Record<string, unknown>): Partner {
  return { id, ...(data as Omit<Partner, "id">) };
}

function mapCommission(id: string, data: Record<string, unknown>): PartnerCommission {
  return { id, ...(data as Omit<PartnerCommission, "id">) };
}

/** The tier a partner qualifies for given their trailing-12-month station count. */
export function tierFor(stations12mo: number): PartnerTier {
  if (stations12mo >= PARTNER_TIER_THRESHOLD.ELITE) return "ELITE";
  if (stations12mo >= PARTNER_TIER_THRESHOLD.AUTHORIZED) return "AUTHORIZED";
  return "ASSOCIATE";
}

async function nextPartnerCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "partners");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-CP-${String(next).padStart(4, "0")}`;
  });
}

export interface PartnerDraft {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  category: PartnerCategory;
  notes?: string;
}

export async function createPartner(draft: PartnerDraft, actor: Actor): Promise<{ id: string; code: string }> {
  const code = await nextPartnerCode();
  const ref = doc(collection(getDb(), PARTNERS));
  await setDoc(ref, {
    code,
    name: draft.name,
    company: draft.company ?? "",
    phone: draft.phone,
    email: draft.email ?? "",
    category: draft.category,
    notes: draft.notes ?? "",
    tier: "ASSOCIATE",
    status: "ACTIVE",
    stationsTrailing12mo: 0,
    totalCommissionEarned: 0,
    totalCommissionPaid: 0,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  return { id: ref.id, code };
}

export async function updatePartner(
  id: string,
  patch: Partial<PartnerDraft> & { status?: "ACTIVE" | "INACTIVE" },
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), PARTNERS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export function subscribePartners(
  cb: (rows: Partner[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), PARTNERS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapPartner(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribePartner(
  id: string,
  cb: (row: Partner | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PARTNERS, id),
    (snap) => cb(snap.exists() ? mapPartner(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export function subscribePartnerCommissions(
  partnerId: string,
  cb: (rows: PartnerCommission[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), COMMISSIONS), where("partnerId", "==", partnerId), orderBy("accruedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapCommission(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeAllCommissions(
  cb: (rows: PartnerCommission[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), COMMISSIONS), orderBy("accruedAt", "desc"), fsLimit(500)),
    (snap) => cb(snap.docs.map((d) => mapCommission(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function setCommissionStatus(
  commission: PartnerCommission,
  status: "PENDING" | "APPROVED" | "PAID",
): Promise<void> {
  await updateDoc(doc(getDb(), COMMISSIONS, commission.id), {
    status,
    paidAt: status === "PAID" ? serverTimestamp() : commission.paidAt ?? null,
  });

  if (status === "PAID" && commission.status !== "PAID") {
    const partnerRef = doc(getDb(), PARTNERS, commission.partnerId);
    const snap = await getDoc(partnerRef);
    if (snap.exists()) {
      const paid = (snap.data().totalCommissionPaid as number) ?? 0;
      await updateDoc(partnerRef, { totalCommissionPaid: paid + commission.amount });
    }
  }
}

/**
 * Called after a lead's payment rollup changes. If the lead was referred by a
 * partner and is now fully paid, accrues that partner's one-time commission —
 * once. Fire-and-forget: a notification/accrual failure must never surface
 * as an error on the payment the user was actually recording.
 */
export function accruePartnerCommissionSafe(leadId: string): void {
  void accruePartnerCommission(leadId).catch((err) => {
    console.error("[partners] failed to accrue commission", err);
  });
}

async function accruePartnerCommission(leadId: string): Promise<void> {
  const db = getDb();
  const leadSnap = await getDoc(doc(db, LEADS, leadId));
  if (!leadSnap.exists()) return;
  const lead = leadSnap.data() as {
    partnerId?: string | null; partnerName?: string | null;
    paidAmount?: number; value?: number; code?: string; client?: { name?: string };
  };

  if (!lead.partnerId) return;
  const value = lead.value ?? 0;
  const paid = lead.paidAmount ?? 0;
  if (value <= 0 || paid < value) return;

  // Idempotent: a commission already accrued for this lead is never duplicated.
  const existing = await getDocs(
    query(collection(db, COMMISSIONS), where("leadId", "==", leadId), fsLimit(1)),
  );
  if (!existing.empty) return;

  const partnerRef = doc(db, PARTNERS, lead.partnerId);
  const partnerSnap = await getDoc(partnerRef);
  if (!partnerSnap.exists()) return;
  const partner = mapPartner(partnerSnap.id, partnerSnap.data());

  const nextStationCount = (partner.stationsTrailing12mo ?? 0) + 1;
  const tier = tierFor(nextStationCount);
  const ratePct = PARTNER_TIER_RATE[tier];
  const amount = Math.round(value * (ratePct / 100));

  await setDoc(doc(collection(db, COMMISSIONS)), {
    partnerId: partner.id,
    partnerName: partner.name,
    leadId,
    leadCode: lead.code ?? "",
    leadName: lead.client?.name ?? "",
    stationValue: value,
    tier,
    ratePct,
    amount,
    status: "PENDING",
    accruedAt: serverTimestamp(),
    paidAt: null,
  });

  await updateDoc(partnerRef, {
    stationsTrailing12mo: nextStationCount,
    tier,
    totalCommissionEarned: (partner.totalCommissionEarned ?? 0) + amount,
    updatedAt: serverTimestamp(),
  });
}
