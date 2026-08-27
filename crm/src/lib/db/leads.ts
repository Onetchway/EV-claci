"use client";

import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  limit as fsLimit, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where, writeBatch, type QueryConstraint,
} from "firebase/firestore";

import {
  finalStageFor, LEAD_TYPE_CODE, STAGES, STAGE_META,
  type ActivityType, type CommercialModel, type EoiStatus, type LeadStatus, type LeadType,
  type RejectionReason, type Source, type Stage,
} from "../constants";
import { diffLead, summariseChanges } from "../diff";
import { getDb } from "../firebase/client";
import {
  buildQuote, normaliseConfig, normaliseExtras, type ConfigItem, type ExtraItem,
} from "../pricing";
import type {
  Actor, ClientInfo, EoiDoc, EoiVersion, FinancingInfo, Lead, MergedLeadRef, SiteInfo,
} from "../types";
import { buildSearchTokens, formatINR, normalisePhone, toDate } from "../utils";
import { logActivitySafe } from "./activity";
import { sortByTimestamp, subscribeUnion } from "./subscribe-union";

export const LEADS = "leads";
const COUNTERS = "counters";

function mapLead(id: string, data: Record<string, unknown>): Lead {
  const lead = { id, ...(data as Omit<Lead, "id">) };
  // "Introduction" was merged into "Contacted" — any lead still stored with
  // the old value (never migrated in Firestore) reads as Contacted instead
  // of crashing every STAGE_META[lead.stage] lookup on an unknown key.
  if ((lead.stage as string) === "INTRODUCTION") lead.stage = "CONTACTED";
  return lead;
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
  const prefix = LEAD_TYPE_CODE[type];
  const field = type.toLowerCase();

  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data()[field] as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { [field]: next }, { merge: true });
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
  /** Client-side OR filter across several types, e.g. the B2B nav view. */
  types?: LeadType[];
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
  /** Show trashed leads instead of hiding them — used only by the Trash page. */
  includeTrashed?: boolean;
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
    if (f.includeTrashed) { if (!l.deletedAt) return false; }
    else if (l.deletedAt) return false;
    if (f.types?.length && !f.types.includes(l.type)) return false;
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
  extras?: ExtraItem[];
  discount?: number;
  oem?: string | null;
  financing?: FinancingInfo;
  site?: SiteInfo;
  stage?: Stage;
  tags?: string[];
  nextFollowUpAt?: Date | null;
  expectedCloseAt?: Date | null;
  partnerId?: string | null;
  partnerName?: string | null;
  commercialModel?: CommercialModel | null;
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
    draft.client.gstin,
    draft.client.city,
    draft.code,
    draft.site?.locationName,
    draft.ownerName,
  );
}

function quoteSnapshot(config: ConfigItem[], extras: ExtraItem[], discount: number) {
  const q = buildQuote(config, { discount, extras });
  return {
    snapshot: {
      subtotal: q.subtotal,
      discount: q.discount,
      gst: q.gst,
      grandTotal: q.grandTotal,
      totalKw: q.totalKw,
      unitCount: q.unitCount,
      effectiveGstPct: q.effectiveGstPct,
    },
    value: q.grandTotal,
  };
}

/** A lead with no bank involvement still carries a financing block. */
export const DEFAULT_FINANCING: FinancingInfo = {
  mode: "SELF",
  stage: "NOT_APPLICABLE",
  bank: "",
  requestedAmount: null,
  sanctionedAmount: null,
  disbursedAmount: null,
  interestRate: null,
  tenureYears: null,
  emi: null,
  applicationNo: "",
  note: "",
  cibilScore: null,
  cibilCheckedAt: null,
  subsidyEnabled: false,
  subsidyAmount: null,
  subsidyPct: null,
};

export async function createLead(draft: LeadDraft, actor: Actor): Promise<Lead> {
  const db = getDb();
  const code = await nextLeadCode(draft.type);
  const ref = doc(collection(db, LEADS));

  const config = normaliseConfig(draft.config ?? []);
  const extras = normaliseExtras(draft.extras ?? []);
  const discount = Math.max(0, Math.round(draft.discount ?? 0));
  const { snapshot, value } = quoteSnapshot(config, extras, discount);
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
    extras,
    discount,
    oem: draft.oem ?? null,
    commercialModel: draft.commercialModel ?? null,
    quote: snapshot,
    value,
    financing: draft.financing ?? DEFAULT_FINANCING,
    eoi: null,
    linkedLeads: [],
    partnerId: draft.partnerId ?? null,
    partnerName: draft.partnerName ?? null,
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
  extras?: ExtraItem[];
  discount?: number;
  oem?: string | null;
  financing?: FinancingInfo;
  site?: SiteInfo;
  tags?: string[];
  type?: LeadType;
  nextFollowUpAt?: Date | null;
  expectedCloseAt?: Date | null;
  partnerId?: string | null;
  partnerName?: string | null;
  commercialModel?: CommercialModel | null;
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
  if (patch.oem !== undefined) update.oem = patch.oem;
  if (patch.commercialModel !== undefined) update.commercialModel = patch.commercialModel;
  if (patch.financing !== undefined) update.financing = patch.financing;
  if (patch.partnerId !== undefined) update.partnerId = patch.partnerId;
  if (patch.partnerName !== undefined) update.partnerName = patch.partnerName;
  if (patch.nextFollowUpAt !== undefined) {
    update.nextFollowUpAt = patch.nextFollowUpAt ? Timestamp.fromDate(patch.nextFollowUpAt) : null;
  }
  if (patch.expectedCloseAt !== undefined) {
    update.expectedCloseAt = patch.expectedCloseAt ? Timestamp.fromDate(patch.expectedCloseAt) : null;
  }

  const configChanged =
    patch.config !== undefined || patch.discount !== undefined || patch.extras !== undefined;
  if (configChanged) {
    const config = normaliseConfig(patch.config ?? lead.config);
    const extras = normaliseExtras(patch.extras ?? lead.extras ?? []);
    const discount = Math.max(0, Math.round(patch.discount ?? lead.discount ?? 0));
    const { snapshot, value } = quoteSnapshot(config, extras, discount);
    update.config = config;
    update.extras = extras;
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
  // Reaching this type's final stage closes the lead; moving back out reopens it.
  if (stage === finalStageFor(lead.type)) update.status = "WON";
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
    status: lead.stage === finalStageFor(lead.type) ? "WON" : "ACTIVE",
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
/**
 * Actor is required (not just nice-to-have) because /leads/{id}'s update
 * rule enforces actorIsSelf('updatedBy') on every write — omitting it here
 * left the field pointing at whatever staff member happened to touch this
 * lead last, so anyone else recording/editing/deleting a payment got a
 * silent-looking "Missing or insufficient permissions" on this rollup
 * write even though the payment sub-document itself (different rules) had
 * already saved fine.
 */
export async function refreshPaymentRollup(leadId: string, actor: Actor): Promise<void> {
  const db = getDb();
  const leadRef = doc(db, LEADS, leadId);
  const snap = await getDocs(collection(db, LEADS, leadId, "payments"));

  const paid = snap.docs
    .map((d) => d.data() as { status: string; totalAmount: number })
    .filter((p) => p.status === "RECEIVED" || p.status === "VERIFIED")
    .reduce((a, p) => a + (p.totalAmount || 0), 0);

  const leadSnap = await getDoc(leadRef);
  const value = (leadSnap.data()?.value as number | undefined) ?? 0;

  await updateDoc(leadRef, {
    paidAmount: paid,
    dueAmount: Math.max(0, value - paid),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

/** Moves a lead to Trash — hidden from normal views, recoverable until permanently deleted. */
export async function trashLead(lead: Lead, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "TRASHED",
    message: "Moved to Trash",
    actor,
  });
}

export async function restoreLead(lead: Lead, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "RESTORED",
    message: "Restored from Trash",
    actor,
  });
}

/**
 * Folds `discard` into `keep` — the two are treated as the same real client
 * accidentally entered twice. Field-level lead data is merged (anything
 * `keep` is missing gets filled from `discard`), and everything reassignable
 * without spoofing who actually did it (tasks, the project record, linked
 * quotations/PIs, partner commissions, a registered charger) is repointed at
 * `keep`. Payments, KYC documents, EOI version history and the activity
 * trail are deliberately left on `discard`'s own subcollections — Firestore
 * rules require e.g. a payment's `createdBy`/a document's `uploadedBy` to be
 * the actor writing it, and activities are flatly immutable, so there is no
 * rule-legal way to re-parent those records onto `keep` without rewriting
 * history. Instead `discard`'s id is recorded on `keep.mergedFrom`, and the
 * lead detail page reads all of those collections across every id in
 * `[keep.id, ...mergedFrom]` — so the surviving lead's page shows the full
 * combined picture without a single historical record's provenance changing.
 * `discard` itself is then trashed (recoverable, same as any other lead)
 * with a `mergedInto` pointer back to `keep`.
 */
export async function mergeLeads(keep: Lead, discard: Lead, actor: Actor): Promise<void> {
  if (keep.id === discard.id) throw new Error("Can't merge a lead with itself.");
  const db = getDb();

  // ---- 1. Fill in anything `keep` is missing from `discard`. ----
  const patch: Record<string, unknown> = {};

  const clientFill: Partial<ClientInfo> = {};
  (["altPhone", "email", "company", "state", "address", "pan", "aadhaarLast4", "gstin"] as const).forEach((k) => {
    if (!keep.client?.[k] && discard.client?.[k]) clientFill[k] = discard.client[k];
  });
  if (Object.keys(clientFill).length) patch.client = { ...keep.client, ...clientFill };

  if (!keep.site && discard.site) patch.site = discard.site;
  if (!keep.financing && discard.financing) patch.financing = discard.financing;
  if (!keep.eoi && discard.eoi) patch.eoi = discard.eoi;
  if (!keep.commercialModel && discard.commercialModel) patch.commercialModel = discard.commercialModel;
  if (!keep.partnerId && discard.partnerId) {
    patch.partnerId = discard.partnerId;
    patch.partnerName = discard.partnerName;
  }

  const mergedTags = [...new Set([...(keep.tags ?? []), ...(discard.tags ?? [])])];
  if (mergedTags.length) patch.tags = mergedTags;

  // Payments physically stay split across both leads' own subcollections
  // (see the doc comment above), but the rollup shown on `keep` should
  // reflect both — `value`/`dueAmount` are the deal size and stay keep's own.
  const paidAmount = (keep.paidAmount ?? 0) + (discard.paidAmount ?? 0);
  patch.paidAmount = paidAmount;
  patch.dueAmount = Math.max(0, (keep.value ?? 0) - paidAmount);

  const mergedFrom: MergedLeadRef[] = [
    ...(keep.mergedFrom ?? []),
    { id: discard.id, code: discard.code, name: discard.client?.name ?? "", ownerId: discard.ownerId },
    ...(discard.mergedFrom ?? []), // a lead already merged into `discard` earlier follows it into `keep`
  ];
  patch.mergedFrom = mergedFrom;

  patch.updatedAt = serverTimestamp();
  patch.updatedBy = actor;
  await updateDoc(doc(db, LEADS, keep.id), patch);

  // ---- 2. Repoint records that can be safely reassigned without rewriting
  // who created/verified/archived them. ----
  async function reassign(collectionName: string, field: string) {
    const snap = await getDocs(query(collection(db, collectionName), where(field, "==", discard.id)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.update(d.ref, { [field]: keep.id });
    await batch.commit();
  }
  await reassign("tasks", "leadId");
  await reassign("quotations", "leadId");
  await reassign("proformaInvoices", "leadId");
  await reassign("projects", "sourceLeadId");
  // Charger registrations and partner commissions each have a narrower
  // write rule (Operations / Finance-and-admin respectively) than who can
  // merge leads (Sales Manager and up) — best-effort, skipped quietly for
  // a merging actor who isn't also cleared to write those collections.
  await reassign("chargerRegistry", "leadId").catch(() => undefined);
  await reassign("partnerCommissions", "leadId").catch(() => undefined);

  // ---- 3. Record the merge, then trash the losing side. ----
  logActivitySafe({
    leadId: keep.id,
    ownerId: keep.ownerId,
    leadCode: keep.code,
    leadName: keep.client?.name,
    type: "MERGED" as ActivityType,
    message: `Merged with duplicate lead ${discard.code} (${discard.client?.name ?? "—"}). Its payments, documents, EOI history and activity trail stay on that record — see the "Merged from" link on this lead.`,
    actor,
  });

  await updateDoc(doc(db, LEADS, discard.id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor,
    mergedInto: { leadId: keep.id, leadCode: keep.code, at: serverTimestamp(), by: actor },
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

/** Confirms a lead sharing contact details with another is a real, separate case (e.g. a repeat customer) rather than an accidental duplicate — excludes it from duplicate detection. */
export async function setDuplicateOverride(lead: Lead, actor: Actor, note?: string): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    duplicateOverride: { note: note ?? "", by: actor, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function clearDuplicateOverride(lead: Lead, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    duplicateOverride: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
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

// ---------------------------------------------------------------------------
// Financing
// ---------------------------------------------------------------------------

export async function updateFinancing(
  lead: Lead,
  financing: FinancingInfo,
  actor: Actor,
): Promise<void> {
  const before = lead.financing ?? DEFAULT_FINANCING;

  await updateDoc(doc(getDb(), LEADS, lead.id), {
    financing,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });

  const bits: string[] = [];
  if (before.mode !== financing.mode) bits.push(`funding ${before.mode} → ${financing.mode}`);
  if (before.stage !== financing.stage) bits.push(`loan stage ${before.stage} → ${financing.stage}`);
  if (before.bank !== financing.bank && financing.bank) bits.push(`bank ${financing.bank}`);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "FINANCING_UPDATED",
    message: `Financing updated${bits.length ? ` — ${bits.join(", ")}` : ""}`,
    changes: [
      { field: "financing.mode", label: "Funding mode", from: before.mode, to: financing.mode },
      { field: "financing.stage", label: "Loan stage", from: before.stage, to: financing.stage },
    ].filter((c) => c.from !== c.to),
    actor,
  });
}

// ---------------------------------------------------------------------------
// Site ↔ franchise pairing
// ---------------------------------------------------------------------------

/**
 * Links a landowner's site enquiry to an investor's franchise, many-to-many —
 * an investor can back several franchises over time, and a landowner can
 * offer several sites. The link is appended on both records in one batch so
 * they can never disagree about who they are paired with.
 */
export async function linkLeads(lead: Lead, other: Lead, actor: Actor): Promise<void> {
  if (lead.id === other.id) throw new Error("A lead cannot be linked to itself.");
  if ((lead.linkedLeads ?? []).some((l) => l.id === other.id)) return;

  const db = getDb();
  const batch = writeBatch(db);

  batch.update(doc(db, LEADS, lead.id), {
    linkedLeads: arrayUnion({ id: other.id, code: other.code, name: other.client?.name ?? "" }),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  batch.update(doc(db, LEADS, other.id), {
    linkedLeads: arrayUnion({ id: lead.id, code: lead.code, name: lead.client?.name ?? "" }),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  await batch.commit();

  for (const [self, partner] of [
    [lead, other],
    [other, lead],
  ] as const) {
    logActivitySafe({
      leadId: self.id,
      ownerId: self.ownerId,
      leadCode: self.code,
      leadName: self.client?.name,
      type: "LINKED",
      message: `Linked to ${partner.code} — ${partner.client?.name ?? "lead"}`,
      actor,
    });
  }
}

/** Removes one link from both sides, leaving any other links each lead has intact. */
export async function unlinkLead(lead: Lead, otherId: string, actor: Actor): Promise<void> {
  const target = (lead.linkedLeads ?? []).find((l) => l.id === otherId);
  if (!target) return;

  const db = getDb();
  const batch = writeBatch(db);

  batch.update(doc(db, LEADS, lead.id), {
    linkedLeads: arrayRemove(target),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  const otherSnap = await getDoc(doc(db, LEADS, otherId));
  if (otherSnap.exists()) {
    const other = mapLead(otherSnap.id, otherSnap.data());
    const backRef = (other.linkedLeads ?? []).find((l) => l.id === lead.id);
    if (backRef) {
      batch.update(doc(db, LEADS, otherId), {
        linkedLeads: arrayRemove(backRef),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    }
  }

  await batch.commit();

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "UNLINKED",
    message: `Unlinked from ${target.code}`,
    actor,
  });
}

/**
 * Existing leads that share a phone, email or GSTIN with the values being
 * entered — surfaced before a new lead is saved so the same investor or site
 * doesn't get double-entered under two different lead records.
 */
export async function findDuplicateLeads(candidate: {
  phone?: string;
  email?: string;
  gstin?: string;
  excludeId?: string;
}): Promise<Lead[]> {
  const needles = [
    candidate.phone ? normalisePhone(candidate.phone) : "",
    candidate.email?.trim().toLowerCase() ?? "",
    candidate.gstin?.trim().toLowerCase() ?? "",
  ].filter((n) => n.length >= 4);
  if (needles.length === 0) return [];

  const db = getDb();
  const found = new Map<string, Lead>();
  for (const needle of needles) {
    const snap = await getDocs(
      query(collection(db, LEADS), where("search", "array-contains", needle), fsLimit(10)),
    );
    for (const d of snap.docs) {
      if (d.id === candidate.excludeId) continue;
      const lead = mapLead(d.id, d.data());
      // Trashed (including a lead already folded into another via mergeLeads,
      // which trashes the losing side) or explicitly confirmed-separate
      // leads are not live duplicates — never flag either.
      if (lead.deletedAt || lead.mergedInto || lead.duplicateOverride) continue;
      found.set(d.id, lead);
    }
  }
  return [...found.values()];
}

/** Candidates for pairing: the opposite lead type, still in play. */
export async function findLinkCandidates(lead: Lead, search: string): Promise<Lead[]> {
  const wanted: LeadType = lead.type === "SITE" ? "FRANCHISE" : "SITE";
  const snap = await getDocs(
    query(collection(getDb(), LEADS), where("type", "==", wanted), fsLimit(200)),
  );
  const needle = search.trim().toLowerCase();

  const linkedIds = new Set((lead.linkedLeads ?? []).map((l) => l.id));
  return snap.docs
    .map((d) => mapLead(d.id, d.data()))
    .filter((l) => l.status !== "REJECTED" && l.id !== lead.id && !linkedIds.has(l.id))
    .filter((l) => {
      if (!needle) return true;
      const hay = [l.code, l.client?.name, l.client?.phone, l.client?.city, l.site?.locationName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, 25);
}

/**
 * Any lead that already carries site details — a site enquiry, or a
 * franchise/RWA/corporate/government lead where the site was filled in
 * directly. Backs the "map an existing location" picker on Site details, so
 * a second lead for the same address doesn't need everything retyped.
 */
export async function findSiteCandidates(search: string, excludeLeadId?: string): Promise<Lead[]> {
  const snap = await getDocs(query(collection(getDb(), LEADS), fsLimit(500)));
  const needle = search.trim().toLowerCase();

  return snap.docs
    .map((d) => mapLead(d.id, d.data()))
    .filter((l) => l.id !== excludeLeadId && !!l.site?.locationName?.trim())
    .filter((l) => {
      if (!needle) return true;
      const hay = [l.code, l.site?.locationName, l.site?.address, l.client?.name, l.client?.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, 25);
}

/**
 * Won leads not yet converted to a project — across every lead type, not just
 * Franchise. Backs the "start from an existing lead" picker on New Project.
 */
export async function findConvertibleLeads(search: string): Promise<Lead[]> {
  const snap = await getDocs(
    query(collection(getDb(), LEADS), where("status", "==", "WON"), fsLimit(300)),
  );
  const needle = search.trim().toLowerCase();

  return snap.docs
    .map((d) => mapLead(d.id, d.data()))
    .filter((l) => !l.projectId)
    .filter((l) => {
      if (!needle) return true;
      const hay = [l.code, l.client?.name, l.client?.phone, l.client?.city, l.site?.locationName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, 25);
}

// ---------------------------------------------------------------------------
// Letter of Intent
// ---------------------------------------------------------------------------

export async function saveEoi(lead: Lead, eoi: EoiDoc, actor: Actor): Promise<void> {
  const existing = lead.eoi;

  await updateDoc(doc(getDb(), LEADS, lead.id), {
    eoi: {
      ...eoi,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      createdBy: existing?.createdBy ?? actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
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
    type: existing ? "EOI_UPDATED" : "EOI_CREATED",
    message: existing
      ? `Letter of Intent ${eoi.number} updated`
      : `Letter of Intent ${eoi.number} drafted for ${formatINR(eoi.totalAmount)}`,
    actor,
  });
}

export const EOI_VERSIONS = "eoiVersions";

/** Pass an array to also pull in a merged-in lead's archived EOI history (see mergeLeads above). */
export function subscribeEoiVersions(
  leadId: string | string[],
  cb: (rows: EoiVersion[]) => void,
  onError?: (e: Error) => void,
): () => void {
  if (Array.isArray(leadId)) {
    if (leadId.length <= 1) return subscribeEoiVersions(leadId[0] ?? "", cb, onError);
    return subscribeUnion<EoiVersion>(leadId, subscribeEoiVersions, (rows) => cb(sortByTimestamp(rows, "archivedAt", "desc")), onError);
  }
  return onSnapshot(
    query(collection(getDb(), LEADS, leadId, EOI_VERSIONS), orderBy("archivedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EoiVersion, "id">) }))),
    (err) => onError?.(err as Error),
  );
}

/**
 * Archives the lead's current LOI (if any) to leads/{id}/eoiVersions, then
 * replaces it with a freshly-built one — client name/address, site, and the
 * quotation are all re-pulled from the lead's current data. Before this,
 * "regenerating" meant re-typing every changed field by hand inside the one
 * live letter, and there was nowhere to see a version a signatory had
 * already been sent once it got edited over.
 */
export async function regenerateEoi(lead: Lead, built: EoiDoc, actor: Actor): Promise<void> {
  const db = getDb();
  if (lead.eoi) {
    await addDoc(collection(db, LEADS, lead.id, EOI_VERSIONS), {
      ...lead.eoi,
      archivedAt: serverTimestamp(),
      archivedBy: actor,
    });
  }

  await updateDoc(doc(db, LEADS, lead.id), {
    eoi: { ...built, createdAt: serverTimestamp(), createdBy: actor },
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
    type: "EOI_REGENERATED",
    message: lead.eoi
      ? `Letter of Intent regenerated as ${built.number} (previous letter ${lead.eoi.number} archived)`
      : `Letter of Intent ${built.number} drafted for ${formatINR(built.totalAmount)}`,
    actor,
  });
}

/** Marks the letter issued and moves the lead to the EOI stage if it is behind. */
export async function issueEoi(lead: Lead, actor: Actor): Promise<void> {
  if (!lead.eoi) throw new Error("Draft the Letter of Intent before issuing it.");

  const update: Record<string, unknown> = {
    "eoi.status": "ISSUED",
    "eoi.issuedBy": actor,
    "eoi.issuedDate": serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  };
  if (STAGES.indexOf(lead.stage) < STAGES.indexOf("EOI")) update.stage = "EOI";

  await updateDoc(doc(getDb(), LEADS, lead.id), update);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "EOI_ISSUED",
    message: `Letter of Intent ${lead.eoi.number} issued to the client`,
    actor,
  });
}

/**
 * Removes the lead's current letter, archiving it to leads/{id}/eoiVersions
 * first (same as regenerating) so it stays retrievable under "Previous
 * versions" rather than vanishing — this is meant for "I drafted the wrong
 * thing, start over," not for erasing the record that a letter existed.
 */
export async function deleteEoi(lead: Lead, actor: Actor): Promise<void> {
  if (!lead.eoi) return;
  const db = getDb();

  await addDoc(collection(db, LEADS, lead.id, EOI_VERSIONS), {
    ...lead.eoi,
    archivedAt: serverTimestamp(),
    archivedBy: actor,
  });

  await updateDoc(doc(db, LEADS, lead.id), {
    eoi: null,
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
    type: "EOI_DELETED",
    message: `Letter of Intent ${lead.eoi.number} deleted`,
    actor,
  });
}

/**
 * Permanently removes one archived version from leads/{id}/eoiVersions.
 * Unlike deleteEoi (which archives the *current* letter), this deletes an
 * already-archived copy outright — there is nowhere further to archive it to.
 */
export async function deleteEoiVersion(lead: Lead, version: EoiVersion, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), LEADS, lead.id, EOI_VERSIONS, version.id));

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "EOI_DELETED",
    message: `Archived Letter of Intent version ${version.number} permanently deleted`,
    actor,
  });
}

export async function setEoiStatus(lead: Lead, status: EoiStatus, actor: Actor): Promise<void> {
  if (!lead.eoi) return;

  const update: Record<string, unknown> = {
    "eoi.status": status,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  };
  if (status === "ACCEPTED") update["eoi.acceptedAt"] = serverTimestamp();

  await updateDoc(doc(getDb(), LEADS, lead.id), update);

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "EOI_UPDATED",
    message: `Letter of Intent marked ${status.toLowerCase()}`,
    actor,
  });
}

/** Sequence for LOI numbers: LG/LOI/2026/0042. */
export async function nextEoiNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, COUNTERS, "eoi");
  const year = new Date().getFullYear();

  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() as { year?: number; seq?: number }) : {};
    const next = data.year === year ? (data.seq ?? 0) + 1 : 1;
    tx.set(ref, { year, seq: next }, { merge: true });
    return next;
  });

  return `LG/LOI/${year}/${String(seq).padStart(4, "0")}`;
}
