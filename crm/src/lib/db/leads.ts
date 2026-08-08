"use client";

import {
  collection, deleteDoc, doc, getDoc, getDocs, limit as fsLimit, onSnapshot,
  orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc,
  where, writeBatch, type QueryConstraint,
} from "firebase/firestore";

import {
  STAGE_META, WON_STAGE,
  type LeadStatus, type LeadType, type RejectionReason, type Source, type Stage,
} from "../constants";
import { diffLead, summariseChanges } from "../diff";
import { getDb } from "../firebase/client";
import { buildQuote, normaliseConfig, type ConfigItem } from "../pricing";
import type { Actor, ClientInfo, Lead, SiteInfo } from "../types";
import { buildSearchTokens, normalisePhone, toDate } from "../utils";
import { logActivitySafe } from "./activity";

export const LEADS = "leads";
const COUNTERS = "counters";

function mapLead(id: string, data: Record<string, unknown>): Lead {
  return { id, ...(data as Omit<Lead, "id">) };
}

// ---------------------------------------------------------------------------
// Lead code sequence
// ---------------------------------------------------------------------------

/**
 * Human-facing reference: LG-FR-000142 / LG-ST-000143. Allocated in a
 * transaction so two agents saving at the same instant can't collide.
 */
export async function nextLeadCode(type: LeadType): Promise<string> {
  const db = getDb();
  const ref = doc(db, COUNTERS, "leads");
  const prefix = type === "SITE" ? "ST" : "FR";
  const field = type === "SITE" ? "site" : "franchise";

  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data()[field] as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    if (snap.exists()) tx.update(ref, { [field]: next });
    else tx.set(ref, { franchise: 0, site: 0, [field]: next });
    return next;
  });

  return `LG-${prefix}-${String(seq).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface LeadFilters {
  /** Agents are pinned to their own uid by the caller. */
  ownerId?: string | null;
  type?: LeadType | "ALL";
  status?: LeadStatus | "ALL";
  stages?: Stage[];
  sources?: Source[];
  city?: string;
  search?: string;
  /** Inclusive bounds on createdAt. */
  from?: Date | null;
  to?: Date | null;
  minValue?: number | null;
  maxValue?: number | null;
  /** Only leads whose next follow-up is already past. */
  overdueOnly?: boolean;
  max?: number;
}

/**
 * Firestore can't express this whole filter set in one composite index without
 * an unreasonable index matrix, so the cheap, highly-selective predicates
 * (owner, type, status) run server-side and the rest are applied in memory over
 * the returned page. Keep `max` sane — this is a CRM pipeline, not a data lake.
 */
export function applyClientFilters(rows: Lead[], f: LeadFilters): Lead[] {
  const needle = f.search?.trim().toLowerCase();
  const from = f.from?.getTime();
  const to = f.to ? new Date(f.to).setHours(23, 59, 59, 999) : undefined;
  const now = Date.now();

  return rows.filter((l) => {
    if (f.stages?.length && !f.stages.includes(l.stage)) return false;
    if (f.sources?.length && !f.sources.includes(l.source)) return false;
    if (f.city && (l.client?.city ?? "").toLowerCase() !== f.city.toLowerCase()) return false;
    if (f.minValue != null && (l.value ?? 0) < f.minValue) return false;
    if (f.maxValue != null && (l.value ?? 0) > f.maxValue) return false;

    if (from || to) {
      const created = toDate(l.createdAt)?.getTime();
      if (!created) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    if (f.overdueOnly) {
      const due = toDate(l.nextFollowUpAt)?.getTime();
      if (!due || due > now) return false;
      if (l.status !== "ACTIVE") return false;
    }

    if (needle) {
      const digits = needle.replace(/\D/g, "");
      const hay = [
        l.code, l.client?.name, l.client?.phone, l.client?.altPhone, l.client?.email,
        l.client?.company, l.client?.city, l.ownerName, l.site?.locationName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const tokenHit = l.search?.some((t) => t.startsWith(needle)) ?? false;
      const phoneHit = digits.length >= 4 && (l.client?.phone ?? "").includes(digits);
      if (!hay.includes(needle) && !tokenHit && !phoneHit) return false;
    }

    return true;
  });
}

export function subscribeLeads(
  filters: LeadFilters,
  cb: (rows: Lead[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const db = getDb();
  const constraints: QueryConstraint[] = [];

  if (filters.ownerId) constraints.push(where("ownerId", "==", filters.ownerId));
  if (filters.type && filters.type !== "ALL") constraints.push(where("type", "==", filters.type));
  if (filters.status && filters.status !== "ALL") constraints.push(where("status", "==", filters.status));
  constraints.push(orderBy("updatedAt", "desc"), fsLimit(filters.max ?? 500));

  return onSnapshot(
    query(collection(db, LEADS), ...constraints),
    (snap) => cb(applyClientFilters(snap.docs.map((d) => mapLead(d.id, d.data())), filters)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeLead(
  id: string,
  cb: (lead: Lead | null) => void,
  onError?: (e: Error) => void,
): () => void {
  const db = getDb();
  return onSnapshot(
    doc(db, LEADS, id),
    (snap) => cb(snap.exists() ? mapLead(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getLead(id: string): Promise<Lead | null> {
  const snap = await getDoc(doc(getDb(), LEADS, id));
  return snap.exists() ? mapLead(snap.id, snap.data()) : null;
}

/** Duplicate guard — the same phone number should not be worked twice. */
export async function findLeadsByPhone(phone: string): Promise<Lead[]> {
  const clean = normalisePhone(phone);
  if (clean.length < 10) return [];
  const snap = await getDocs(
    query(collection(getDb(), LEADS), where("client.phone", "==", clean), fsLimit(5)),
  );
  return snap.docs.map((d) => mapLead(d.id, d.data()));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface LeadDraft {
  type: LeadType;
  client: ClientInfo;
  source: Source;
  sourceDetail?: string;
  config?: ConfigItem[];
  discount?: number;
  site?: SiteInfo;
  stage?: Stage;
  tags?: string[];
  nextFollowUpAt?: Date | null;
  expectedCloseAt?: Date | null;
  ownerId: string;
  ownerName: string;
}

function searchTokensFor(draft: {
  client: ClientInfo;
  code: string;
  site?: SiteInfo;
  ownerName: string;
}): string[] {
  return buildSearchTokens(
    draft.client.name,
    draft.client.phone,
    draft.client.altPhone,
    draft.client.email,
    draft.client.company,
    draft.client.city,
    draft.code,
    draft.site?.locationName,
    draft.ownerName,
  );
}

function quoteSnapshot(config: ConfigItem[], discount: number) {
  const q = buildQuote(config, { discount });
  return {
    snapshot: {
      subtotal: q.subtotal,
      discount: q.discount,
      gst: q.gst,
      grandTotal: q.grandTotal,
      totalKw: q.totalKw,
      unitCount: q.unitCount,
    },
    value: q.grandTotal,
  };
}

export async function createLead(draft: LeadDraft, actor: Actor): Promise<Lead> {
  const db = getDb();
  const code = await nextLeadCode(draft.type);
  const ref = doc(collection(db, LEADS));

  const config = normaliseConfig(draft.config ?? []);
  const discount = Math.max(0, Math.round(draft.discount ?? 0));
  const { snapshot, value } = quoteSnapshot(config, discount);
  const client: ClientInfo = { ...draft.client, phone: normalisePhone(draft.client.phone) };

  const payload = {
    code,
    type: draft.type,
    stage: draft.stage ?? ("NEW" as Stage),
    status: "ACTIVE" as LeadStatus,
    client,
    source: draft.source,
    sourceDetail: draft.sourceDetail ?? "",
    config,
    discount,
    quote: snapshot,
    value,
    site: draft.site ?? {},
    ownerId: draft.ownerId,
    ownerName: draft.ownerName,
    tags: draft.tags ?? [],
    nextFollowUpAt: draft.nextFollowUpAt ? Timestamp.fromDate(draft.nextFollowUpAt) : null,
    expectedCloseAt: draft.expectedCloseAt ? Timestamp.fromDate(draft.expectedCloseAt) : null,
    rejection: null,
    paidAmount: 0,
    dueAmount: value,
    docCount: 0,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
    search: searchTokensFor({ client, code, site: draft.site, ownerName: draft.ownerName }),
  };

  await setDoc(ref, payload);

  logActivitySafe({
    leadId: ref.id,
    ownerId: draft.ownerId,
    leadCode: code,
    leadName: client.name,
    type: "CREATED",
    message: `Lead created from ${draft.source.replace(/_/g, " ").toLowerCase()} and assigned to ${draft.ownerName}`,
    actor,
  });

  return { id: ref.id, ...(payload as unknown as Omit<Lead, "id">) };
}

export interface LeadPatch {
  client?: ClientInfo;
  source?: Source;
  sourceDetail?: string;
  config?: ConfigItem[];
  discount?: number;
  site?: SiteInfo;
  tags?: string[];
  type?: LeadType;
  nextFollowUpAt?: Date | null;
  expectedCloseAt?: Date | null;
}

export async function updateLead(lead: Lead, patch: LeadPatch, actor: Actor): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = {};

  if (patch.client) update.client = { ...patch.client, phone: normalisePhone(patch.client.phone) };
  if (patch.source !== undefined) update.source = patch.source;
  if (patch.sourceDetail !== undefined) update.sourceDetail = patch.sourceDetail;
  if (patch.site !== undefined) update.site = patch.site;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.nextFollowUpAt !== undefined) {
    update.nextFollowUpAt = patch.nextFollowUpAt ? Timestamp.fromDate(patch.nextFollowUpAt) : null;
  }
  if (patch.expectedCloseAt !== undefined) {
    update.expectedCloseAt = patch.expectedCloseAt ? Timestamp.fromDate(patch.expectedCloseAt) : null;
  }

  const configChanged = patch.config !== undefined || patch.discount !== undefined;
  if (configChanged) {
    const config = normaliseConfig(patch.config ?? lead.config);
    const discount = Math.max(0, Math.round(patch.discount ?? lead.discount ?? 0));
    const { snapshot, value } = quoteSnapshot(config, discount);
    update.config = config;
    update.discount = discount;
    update.quote = snapshot;
    update.value = value;
    update.dueAmount = Math.max(0, value - (lead.paidAmount ?? 0));
  }

  const changes = diffLead(lead, update);
  if (!changes.length) return;

  const nextClient = (update.client as ClientInfo | undefined) ?? lead.client;
  const nextSite = (update.site as SiteInfo | undefined) ?? lead.site;
  update.search = searchTokensFor({
    client: nextClient,
    code: lead.code,
    site: nextSite,
    ownerName: lead.ownerName,
  });
  update.updatedAt = serverTimestamp();
  update.updatedBy = actor;
  update.lastActivityAt = serverTimestamp();
  update.lastActivityBy = actor.name;

  await updateDoc(doc(db, LEADS, lead.id), update);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: nextClient.name,
    type: configChanged && changes.some((c) => c.field === "config") ? "CONFIG_CHANGED" : "UPDATED",
    message: summariseChanges(changes),
    changes,
    actor,
  });
}

export async function changeStage(lead: Lead, stage: Stage, actor: Actor, note?: string): Promise<void> {
  if (lead.stage === stage) return;
  const db = getDb();

  const update: Record<string, unknown> = {
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  };
  // Reaching handover closes the lead; moving back out of it reopens.
  if (stage === WON_STAGE) update.status = "WON";
  else if (lead.status === "WON") update.status = "ACTIVE";

  await updateDoc(doc(db, LEADS, lead.id), update);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "STAGE_CHANGED",
    message: `Stage moved ${STAGE_META[lead.stage].label} → ${STAGE_META[stage].label}${note ? ` — ${note}` : ""}`,
    changes: [{ field: "stage", label: "Stage", from: STAGE_META[lead.stage].label, to: STAGE_META[stage].label }],
    actor,
  });
}

export async function rejectLead(
  lead: Lead,
  reason: RejectionReason,
  note: string,
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    status: "REJECTED",
    rejection: { reason, note, at: serverTimestamp(), by: actor },
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "REJECTED",
    message: `Lead rejected — ${reason.replace(/_/g, " ").toLowerCase()}${note ? `: ${note}` : ""}`,
    changes: [{ field: "status", label: "Status", from: lead.status, to: "REJECTED" }],
    actor,
  });
}

export async function reopenLead(lead: Lead, actor: Actor, note?: string): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    status: lead.stage === WON_STAGE ? "WON" : "ACTIVE",
    rejection: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "REOPENED",
    message: `Lead reopened${note ? ` — ${note}` : ""}`,
    actor,
  });
}

export async function setLeadStatus(lead: Lead, status: LeadStatus, actor: Actor): Promise<void> {
  if (lead.status === status) return;
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });
  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "STATUS_CHANGED",
    message: `Status changed ${lead.status} → ${status}`,
    changes: [{ field: "status", label: "Status", from: lead.status, to: status }],
    actor,
  });
}

export async function reassignLead(
  lead: Lead,
  ownerId: string,
  ownerName: string,
  actor: Actor,
): Promise<void> {
  if (lead.ownerId === ownerId) return;
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    ownerId,
    ownerName,
    search: searchTokensFor({ client: lead.client, code: lead.code, site: lead.site, ownerName }),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });

  logActivitySafe({
    leadId: lead.id,
    // Logged against the new owner so the entry travels with the lead.
    ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "ASSIGNED",
    message: `Reassigned from ${lead.ownerName} to ${ownerName}`,
    changes: [{ field: "ownerName", label: "Assigned agent", from: lead.ownerName, to: ownerName }],
    actor,
  });
}

/** Keeps the denormalised payment rollup on the lead in step with its ledger. */
export async function refreshPaymentRollup(leadId: string): Promise<void> {
  const db = getDb();
  const leadRef = doc(db, LEADS, leadId);
  const snap = await getDocs(collection(db, LEADS, leadId, "payments"));

  const paid = snap.docs
    .map((d) => d.data() as { status: string; totalAmount: number })
    .filter((p) => p.status === "RECEIVED" || p.status === "VERIFIED")
    .reduce((a, p) => a + (p.totalAmount || 0), 0);

  const leadSnap = await getDoc(leadRef);
  const value = (leadSnap.data()?.value as number | undefined) ?? 0;

  await updateDoc(leadRef, { paidAmount: paid, dueAmount: Math.max(0, value - paid) });
}

/** Hard delete — super admin only, and it takes the sub-collections with it. */
export async function deleteLead(lead: Lead): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  for (const sub of ["payments", "documents"]) {
    const snap = await getDocs(collection(db, LEADS, lead.id, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
  await deleteDoc(doc(db, LEADS, lead.id));
}
