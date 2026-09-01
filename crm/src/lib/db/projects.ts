"use client";

import {
  collection, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  writeBatch, type QueryConstraint,
} from "firebase/firestore";

import {
  PROJECT_STAGES, PROJECT_STAGE_META, WORKSTREAMS, WORKSTREAM_LABEL,
  type ProjectOwnership, type ProjectStage, type ProjectStatus, type TaskStatus,
  type Workstream,
} from "../constants";
import { getDb } from "../firebase/client";
import { buildQuote, normaliseConfig, normaliseExtras } from "../pricing";
import { getCurrentTenantId } from "../tenant";
import type { Actor, Lead, Project, ProjectWorkstream } from "../types";
import { buildSearchTokens, toDate } from "../utils";
import { logActivitySafe } from "./activity";

export const PROJECTS = "projects";
const COUNTERS = "counters";

function mapProject(id: string, data: Record<string, unknown>): Project {
  return { id, ...(data as Omit<Project, "id">) };
}

/** LG-PRJ-000142 / LG-COCO-000007, allocated transactionally. */
export async function nextProjectCode(ownership: ProjectOwnership): Promise<string> {
  const db = getDb();
  const ref = doc(db, COUNTERS, "projects");
  const field = ownership === "COCO" ? "coco" : "franchise";
  const prefix = ownership === "COCO" ? "COCO" : "PRJ";

  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data()[field] as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { [field]: next }, { merge: true });
    return next;
  });

  return `LG-${prefix}-${String(seq).padStart(6, "0")}`;
}

/** A fresh set of workstreams, all not-started. */
export function blankWorkstreams(): Record<Workstream, ProjectWorkstream> {
  return Object.fromEntries(
    WORKSTREAMS.map((w) => [
      w,
      {
        key: w,
        label: WORKSTREAM_LABEL[w],
        status: "NOT_STARTED" as TaskStatus,
        progressPct: 0,
        vendor: "",
        vendorPhone: "",
        plannedStart: null,
        plannedEnd: null,
        actualStart: null,
        actualEnd: null,
        cost: null,
        note: "",
      },
    ]),
  ) as Record<Workstream, ProjectWorkstream>;
}

/** Overall completion — the mean of every workstream that actually applies. */
export function projectProgress(project: Project): number {
  const ws = Object.values(project.workstreams ?? {});
  const applicable = ws.filter((w) => w.status !== "NOT_APPLICABLE");
  if (!applicable.length) return 0;
  const total = applicable.reduce(
    (a, w) => a + (w.status === "DONE" ? 100 : Math.max(0, Math.min(100, w.progressPct ?? 0))),
    0,
  );
  return Math.round(total / applicable.length);
}

/** Workstreams that are blocked, or overdue against their planned end date. */
export function projectRisks(project: Project): { key: Workstream; label: string; reason: string }[] {
  const now = Date.now();
  return Object.values(project.workstreams ?? {})
    .flatMap((w) => {
      if (w.status === "BLOCKED") return [{ key: w.key, label: w.label, reason: "Blocked" }];
      const due = toDate(w.plannedEnd)?.getTime();
      if (due && due < now && w.status !== "DONE" && w.status !== "NOT_APPLICABLE") {
        return [{ key: w.key, label: w.label, reason: "Past its planned end date" }];
      }
      return [];
    });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface ProjectFilters {
  ownership?: ProjectOwnership | "ALL";
  status?: ProjectStatus | "ALL";
  stages?: ProjectStage[];
  managerId?: string | null;
  search?: string;
  /** Show trashed projects instead of hiding them — used only by the Trash page. */
  includeTrashed?: boolean;
  max?: number;
}

export function applyProjectFilters(rows: Project[], f: ProjectFilters): Project[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((p) => {
    if (f.includeTrashed) { if (!p.deletedAt) return false; }
    else if (p.deletedAt) return false;
    if (f.stages?.length && !f.stages.includes(p.stage)) return false;
    if (f.managerId && p.managerId !== f.managerId) return false;
    if (needle) {
      const hay = [
        p.code, p.name, p.client?.name, p.client?.phone, p.site?.locationName,
        p.site?.city, p.managerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle) && !(p.search ?? []).some((t) => t.startsWith(needle))) return false;
    }
    return true;
  });
}

export function subscribeProjects(
  filters: ProjectFilters,
  cb: (rows: Project[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const db = getDb();
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    const constraints: QueryConstraint[] = [where("orgId", "==", orgId)];
    if (filters.ownership && filters.ownership !== "ALL") {
      constraints.push(where("ownership", "==", filters.ownership));
    }
    if (filters.status && filters.status !== "ALL") constraints.push(where("status", "==", filters.status));
    constraints.push(orderBy("updatedAt", "desc"), fsLimit(filters.max ?? 300));

    unsubscribe = onSnapshot(
      query(collection(db, PROJECTS), ...constraints),
      (snap) => cb(applyProjectFilters(snap.docs.map((d) => mapProject(d.id, d.data())), filters)),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeProject(
  id: string,
  cb: (p: Project | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PROJECTS, id),
    (snap) => cb(snap.exists() ? mapProject(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(getDb(), PROJECTS, id));
  return snap.exists() ? mapProject(snap.id, snap.data()) : null;
}

/** Has this lead already been converted? Prevents duplicate projects. */
export async function findProjectForLead(leadId: string): Promise<Project | null> {
  const orgId = await getCurrentTenantId();
  const snap = await getDocs(
    query(collection(getDb(), PROJECTS), where("orgId", "==", orgId), where("sourceLeadId", "==", leadId), fsLimit(1)),
  );
  const first = snap.docs[0];
  return first ? mapProject(first.id, first.data()) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface ProjectDraft {
  ownership: ProjectOwnership;
  name: string;
  client?: Project["client"];
  site: Project["site"];
  config?: Project["config"];
  extras?: Project["extras"];
  discount?: number;
  managerId?: string;
  managerName?: string;
  sourceLeadId?: string | null;
  sourceLeadCode?: string | null;
  capexBudget?: number | null;
  targetLiveAt?: Date | null;
  note?: string;
}

function searchTokensForProject(d: {
  code: string;
  name: string;
  client?: Project["client"];
  site: Project["site"];
  managerName?: string;
}): string[] {
  return buildSearchTokens(
    d.code, d.name, d.client?.name, d.client?.phone, d.site?.locationName,
    d.site?.city, d.site?.state, d.managerName,
  );
}

export async function createProject(draft: ProjectDraft, actor: Actor): Promise<Project> {
  const db = getDb();
  const code = await nextProjectCode(draft.ownership);
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(db, PROJECTS));

  const config = normaliseConfig(draft.config ?? []);
  const extras = normaliseExtras(draft.extras ?? []);
  const quote = buildQuote(config, { discount: draft.discount ?? 0, extras });

  const payload = {
    code,
    orgId,
    ownership: draft.ownership,
    name: draft.name,
    stage: "PLANNING" as ProjectStage,
    status: "ACTIVE" as ProjectStatus,
    client: draft.client ?? null,
    site: draft.site,
    config,
    extras,
    discount: draft.discount ?? 0,
    value: quote.grandTotal,
    totalKw: quote.totalKw,
    unitCount: quote.unitCount,
    capexBudget: draft.capexBudget ?? (draft.ownership === "COCO" ? quote.grandTotal : null),
    capexSpent: 0,
    workstreams: blankWorkstreams(),
    discom: {
      stage: "NOT_APPLIED",
      connectionType: null,
      sanctionedLoadKva: null,
      consumerNumber: "",
      applicationNo: "",
      demandNoteAmount: null,
      note: "",
      appliedAt: null,
      energisedAt: null,
    },
    managerId: draft.managerId ?? actor.uid,
    managerName: draft.managerName ?? actor.name,
    sourceLeadId: draft.sourceLeadId ?? null,
    sourceLeadCode: draft.sourceLeadCode ?? null,
    targetLiveAt: draft.targetLiveAt ? Timestamp.fromDate(draft.targetLiveAt) : null,
    liveAt: null,
    note: draft.note ?? "",
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    search: searchTokensForProject({
      code,
      name: draft.name,
      client: draft.client,
      site: draft.site,
      managerName: draft.managerName,
    }),
  };

  await setDoc(ref, payload);

  logActivitySafe({
    leadId: ref.id,
    ownerId: payload.managerId,
    leadCode: code,
    leadName: draft.name,
    type: "PROJECT_CREATED",
    message:
      draft.ownership === "COCO"
        ? `Company-owned project ${code} created`
        : `Project ${code} created from ${draft.sourceLeadCode ?? "a franchise deal"}`,
    actor,
  });

  return { id: ref.id, ...(payload as unknown as Omit<Project, "id">) };
}

/**
 * Turns a won franchise lead into a project. The lead keeps its own record —
 * the sales history stays intact — and the two are cross-referenced.
 */
export async function convertLeadToProject(lead: Lead, actor: Actor): Promise<Project> {
  const existing = await findProjectForLead(lead.id);
  if (existing) throw new Error(`This lead is already project ${existing.code}.`);

  const project = await createProject(
    {
      // Only a Franchise lead is investor-funded; every other lead type
      // (RWA, Corporate, Government, Charger Sale, EPC, Software, Others,
      // Site) is Livanto building/operating directly.
      ownership: lead.type === "FRANCHISE" ? "FRANCHISE" : "COCO",
      name: lead.site?.locationName?.trim() || `${lead.client?.name} — ${lead.client?.city}`,
      client: {
        name: lead.client?.name ?? "",
        phone: lead.client?.phone ?? "",
        email: lead.client?.email ?? "",
        company: lead.client?.company ?? "",
      },
      site: {
        locationName: lead.site?.locationName ?? "",
        address: lead.client?.address ?? "",
        city: lead.client?.city ?? "",
        state: lead.client?.state ?? "",
        mapsLink: lead.site?.mapsLink ?? "",
        lat: lead.site?.lat ?? null,
        lng: lead.site?.lng ?? null,
        locationTypes: lead.site?.locationTypes ?? [],
        landType: lead.site?.landType ?? null,
        ownerType: lead.site?.ownerType ?? null,
        spaceAvailableSqft: lead.site?.spaceAvailableSqft ?? null,
      },
      config: lead.config,
      extras: lead.extras,
      discount: lead.discount,
      managerId: lead.ownerId,
      managerName: lead.ownerName,
      sourceLeadId: lead.id,
      sourceLeadCode: lead.code,
    },
    actor,
  );

  await updateDoc(doc(getDb(), "leads", lead.id), {
    projectId: project.id,
    projectCode: project.code,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "PROJECT_CREATED",
    message: `Converted to project ${project.code}`,
    actor,
  });

  return project;
}

export interface ProjectPatch {
  name?: string;
  client?: Project["client"];
  site?: Project["site"];
  config?: Project["config"];
  extras?: Project["extras"];
  discount?: number;
  managerId?: string;
  managerName?: string;
  capexBudget?: number | null;
  capexSpent?: number | null;
  targetLiveAt?: Date | null;
  discom?: Project["discom"];
  note?: string;
}

export async function updateProject(
  project: Project,
  patch: ProjectPatch,
  actor: Actor,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };

  for (const k of ["name", "client", "site", "managerId", "managerName", "discom", "note"] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  for (const k of ["capexBudget", "capexSpent"] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  if (patch.targetLiveAt !== undefined) {
    update.targetLiveAt = patch.targetLiveAt ? Timestamp.fromDate(patch.targetLiveAt) : null;
  }

  if (patch.config !== undefined || patch.extras !== undefined || patch.discount !== undefined) {
    const config = normaliseConfig(patch.config ?? project.config);
    const extras = normaliseExtras(patch.extras ?? project.extras ?? []);
    const discount = Math.max(0, Math.round(patch.discount ?? project.discount ?? 0));
    const quote = buildQuote(config, { discount, extras });
    update.config = config;
    update.extras = extras;
    update.discount = discount;
    update.value = quote.grandTotal;
    update.totalKw = quote.totalKw;
    update.unitCount = quote.unitCount;
  }

  update.search = searchTokensForProject({
    code: project.code,
    name: (patch.name ?? project.name) as string,
    client: patch.client ?? project.client ?? undefined,
    site: patch.site ?? project.site,
    managerName: patch.managerName ?? project.managerName,
  });

  await updateDoc(doc(getDb(), PROJECTS, project.id), update);

  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "PROJECT_UPDATED",
    message: "Project details updated",
    actor,
  });
}

export async function changeProjectStage(
  project: Project,
  stage: ProjectStage,
  actor: Actor,
  note?: string,
): Promise<void> {
  if (project.stage === stage) return;

  const update: Record<string, unknown> = {
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };
  // Reaching Live closes the project out; moving back off it reopens.
  if (stage === "LIVE") {
    update.status = "LIVE";
    update.liveAt = serverTimestamp();
  } else if (project.status === "LIVE") {
    update.status = "ACTIVE";
    update.liveAt = null;
  }

  await updateDoc(doc(getDb(), PROJECTS, project.id), update);

  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "PROJECT_STAGE_CHANGED",
    message: `Stage moved ${PROJECT_STAGE_META[project.stage].label} → ${PROJECT_STAGE_META[stage].label}${note ? ` — ${note}` : ""}`,
    changes: [
      {
        field: "stage",
        label: "Project stage",
        from: PROJECT_STAGE_META[project.stage].label,
        to: PROJECT_STAGE_META[stage].label,
      },
    ],
    actor,
  });
}

export async function setProjectStatus(
  project: Project,
  status: ProjectStatus,
  actor: Actor,
): Promise<void> {
  if (project.status === status) return;
  await updateDoc(doc(getDb(), PROJECTS, project.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "PROJECT_STATUS_CHANGED",
    message: `Project marked ${status.replace(/_/g, " ").toLowerCase()}`,
    actor,
  });
}

export async function updateWorkstream(
  project: Project,
  key: Workstream,
  patch: Partial<ProjectWorkstream>,
  actor: Actor,
): Promise<void> {
  const before = project.workstreams?.[key];
  const merged: ProjectWorkstream = {
    ...(before ?? blankWorkstreams()[key]),
    ...patch,
    key,
  };
  // Done always reads as complete; the two would otherwise disagree on the
  // overall progress bar.
  if (merged.status === "DONE") merged.progressPct = 100;

  const update: Record<string, unknown> = {
    [`workstreams.${key}`]: {
      ...merged,
      plannedStart: toTs(merged.plannedStart),
      plannedEnd: toTs(merged.plannedEnd),
      actualStart: toTs(merged.actualStart),
      actualEnd: toTs(merged.actualEnd),
    },
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };

  await updateDoc(doc(getDb(), PROJECTS, project.id), update);

  const bits: string[] = [];
  if (before && before.status !== merged.status) bits.push(`${before.status} → ${merged.status}`);
  if (before && before.progressPct !== merged.progressPct) bits.push(`${merged.progressPct}%`);

  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "WORKSTREAM_UPDATED",
    message: `${WORKSTREAM_LABEL[key]} updated${bits.length ? ` — ${bits.join(", ")}` : ""}`,
    actor,
  });
}

function toTs(v: unknown): Timestamp | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v;
  const d = toDate(v as never);
  return d ? Timestamp.fromDate(d) : null;
}

/** Suggests the stage that matches how far the workstreams have actually got. */
export function suggestedStage(project: Project): ProjectStage {
  const ws = project.workstreams ?? ({} as Record<Workstream, ProjectWorkstream>);
  const done = (k: Workstream) => ws[k]?.status === "DONE";
  const started = (k: Workstream) =>
    ws[k]?.status === "IN_PROGRESS" || ws[k]?.status === "DONE";

  if (done("NETWORK") && done("CHARGER") && project.discom?.stage === "ENERGISED") return "LIVE";
  if (started("NETWORK")) return "TESTING_COMMISSIONING";
  if (started("CHARGER")) return "CHARGER_INSTALLATION";
  if (project.discom?.stage && project.discom.stage !== "NOT_APPLIED") return "DISCOM_SANCTION";
  if (started("ELECTRICAL")) return "ELECTRICAL_WORK";
  if (started("CIVIL")) return "CIVIL_WORK";
  if (done("SITE_READINESS")) return "AGREEMENT_SIGNED";
  if (started("SITE_READINESS")) return "SITE_SURVEY";
  return "PLANNING";
}

export const ALL_PROJECT_STAGES = PROJECT_STAGES;

/** Moves a project to Trash — hidden from normal views, recoverable until permanently deleted. */
export async function trashProject(project: Project, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROJECTS, project.id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "PROJECT_TRASHED",
    message: "Moved to Trash",
    actor,
  });
}

export async function restoreProject(project: Project, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROJECTS, project.id), {
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  logActivitySafe({
    leadId: project.id,
    ownerId: project.managerId,
    leadCode: project.code,
    leadName: project.name,
    type: "PROJECT_RESTORED",
    message: "Restored from Trash",
    actor,
  });
}

/** Super-admin only; takes the sub-collections with it. */
export async function deleteProject(project: Project): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  for (const sub of ["documents"]) {
    const snap = await getDocs(collection(db, PROJECTS, project.id, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, PROJECTS, project.id));
  await batch.commit();
}
