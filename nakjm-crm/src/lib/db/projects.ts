"use client";

import {
  collection, deleteDoc, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { ProjectStatus, ProjectType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Project, ProjectSite, ProjectTeamAssignment } from "../types";
import { buildSearchTokens } from "../utils";
import { logActivitySafe } from "./activity";

export const PROJECTS = "projects";
const COUNTERS = "counters";

function mapProject(id: string, data: Record<string, unknown>): Project {
  return { id, ...(data as Omit<Project, "id">) };
}

/** NKJM-000142, allocated transactionally so two admins can't collide. */
export async function nextProjectCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, COUNTERS, "projects");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-${String(seq).padStart(5, "0")}`;
}

export interface ProjectFilters {
  status?: ProjectStatus | "ALL";
  clientId?: string;
  search?: string;
  includeTrashed?: boolean;
  max?: number;
}

function searchTokensForProject(d: { code: string; name: string; clientName: string; site: ProjectSite }): string[] {
  return buildSearchTokens(d.code, d.name, d.clientName, d.site?.city, d.site?.state);
}

export function applyProjectFilters(rows: Project[], f: ProjectFilters): Project[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((p) => {
    if (f.includeTrashed) { if (!p.deletedAt) return false; }
    else if (p.deletedAt) return false;
    if (f.status && f.status !== "ALL" && p.status !== f.status) return false;
    if (f.clientId && p.clientId !== f.clientId) return false;
    if (needle) {
      const hay = [p.code, p.name, p.clientName, p.site?.city].filter(Boolean).join(" ").toLowerCase();
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
  return onSnapshot(
    query(collection(getDb(), PROJECTS), orderBy("updatedAt", "desc"), fsLimit(filters.max ?? 300)),
    (snap) => cb(applyProjectFilters(snap.docs.map((d) => mapProject(d.id, d.data())), filters)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeProject(id: string, cb: (p: Project | null) => void, onError?: (e: Error) => void): () => void {
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

export async function listProjectsForClient(clientId: string): Promise<Project[]> {
  const snap = await getDocs(query(collection(getDb(), PROJECTS), where("clientId", "==", clientId)));
  return snap.docs.map((d) => mapProject(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export function subscribeSubprojects(parentProjectId: string, cb: (rows: Project[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PROJECTS), where("parentProjectId", "==", parentProjectId)),
    (snap) => cb(
      snap.docs.map((d) => mapProject(d.id, d.data()))
        .filter((p) => !p.deletedAt)
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    ),
    (err) => onError?.(err as Error),
  );
}

export interface ProjectDraft {
  name: string;
  clientId: string;
  clientName: string;
  projectManagerId?: string | null;
  projectManagerName?: string | null;
  projectType: ProjectType;
  site: ProjectSite;
  capacityKw?: number | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  budgetAmount?: number;
  contractValue?: number;
  pocName?: string;
  pocPhone?: string;
  pocEmail?: string;
  notes?: string;
  clientRequirements?: string;
  billingGstin?: string | null;
  billingState?: string | null;
  sourceDocumentId?: string | null;
  tenderId?: string | null;
  parentProjectId?: string | null;
  parentProjectCode?: string | null;
}

export async function createProject(draft: ProjectDraft, actor: Actor): Promise<Project> {
  const db = getDb();
  const code = await nextProjectCode();
  const ref = doc(collection(db, PROJECTS));

  const payload = {
    code,
    name: draft.name,
    clientId: draft.clientId,
    clientName: draft.clientName,
    projectManagerId: draft.projectManagerId ?? null,
    projectManagerName: draft.projectManagerName ?? null,
    projectType: draft.projectType,
    site: draft.site,
    capacityKw: draft.capacityKw ?? null,
    status: draft.status ?? "LEAD",
    startDate: draft.startDate ? Timestamp.fromDate(draft.startDate) : null,
    targetEndDate: draft.targetEndDate ? Timestamp.fromDate(draft.targetEndDate) : null,
    actualEndDate: null,
    budgetAmount: draft.budgetAmount ?? 0,
    contractValue: draft.contractValue ?? 0,
    pocName: draft.pocName ?? "",
    pocPhone: draft.pocPhone ?? "",
    pocEmail: draft.pocEmail ?? "",
    notes: draft.notes ?? "",
    clientRequirements: draft.clientRequirements ?? "",
    billingGstin: draft.billingGstin ?? null,
    billingState: draft.billingState ?? null,
    team: [] as ProjectTeamAssignment[],
    sourceDocumentId: draft.sourceDocumentId ?? null,
    tenderId: draft.tenderId ?? null,
    parentProjectId: draft.parentProjectId ?? null,
    parentProjectCode: draft.parentProjectCode ?? null,
    deletedAt: null,
    search: searchTokensForProject({ code, name: draft.name, clientName: draft.clientName, site: draft.site }),
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };

  await setDoc(ref, payload);
  logActivitySafe({ entityType: "PROJECT", entityId: ref.id, entityLabel: `${code} — ${draft.name}`, action: "CREATE", message: `Created project ${code} — ${draft.name}`, actor, projectId: ref.id });
  return { id: ref.id, ...(payload as unknown as Omit<Project, "id">) };
}

export interface ProjectPatch {
  name?: string;
  projectManagerId?: string | null;
  projectManagerName?: string | null;
  site?: ProjectSite;
  capacityKw?: number | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  actualEndDate?: Date | null;
  budgetAmount?: number;
  contractValue?: number;
  pocName?: string;
  pocPhone?: string;
  pocEmail?: string;
  notes?: string;
  clientRequirements?: string;
  billingGstin?: string | null;
  billingState?: string | null;
}

export async function updateProject(project: Project, patch: ProjectPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp(), updatedBy: actor };

  for (const k of ["name", "projectManagerId", "projectManagerName", "site", "pocName", "pocPhone", "pocEmail", "notes", "clientRequirements", "status", "capacityKw", "budgetAmount", "contractValue", "billingGstin", "billingState"] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  for (const k of ["startDate", "targetEndDate", "actualEndDate"] as const) {
    if (patch[k] !== undefined) update[k] = patch[k] ? Timestamp.fromDate(patch[k] as Date) : null;
  }
  if (patch.name || patch.site) {
    update.search = searchTokensForProject({
      code: project.code,
      name: (patch.name ?? project.name) as string,
      clientName: project.clientName,
      site: patch.site ?? project.site,
    });
  }

  await updateDoc(doc(getDb(), PROJECTS, project.id), update);
  logActivitySafe({
    entityType: "PROJECT", entityId: project.id, entityLabel: `${project.code} — ${patch.name ?? project.name}`,
    action: patch.status && patch.status !== project.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== project.status
      ? `Changed ${project.code} status to ${patch.status}`
      : `Updated project ${project.code}`,
    actor, projectId: project.id,
  });
}

/** Assign / unassign a team member — the whole array is small, so it's stored inline on the project. */
export async function assignTeamMember(project: Project, assignment: ProjectTeamAssignment, actor: Actor): Promise<void> {
  const team = [...project.team.filter((t) => t.teamMemberId !== assignment.teamMemberId), assignment];
  await updateDoc(doc(getDb(), PROJECTS, project.id), { team, updatedAt: serverTimestamp(), updatedBy: actor });
}

export async function unassignTeamMember(project: Project, teamMemberId: string, actor: Actor): Promise<void> {
  const team = project.team.filter((t) => t.teamMemberId !== teamMemberId);
  await updateDoc(doc(getDb(), PROJECTS, project.id), { team, updatedAt: serverTimestamp(), updatedBy: actor });
}

export async function trashProject(project: Project, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROJECTS, project.id), {
    deletedAt: serverTimestamp(), deletedBy: actor, updatedAt: serverTimestamp(), updatedBy: actor,
  });
}

export async function restoreProject(project: Project, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROJECTS, project.id), {
    deletedAt: null, deletedBy: null, updatedAt: serverTimestamp(), updatedBy: actor,
  });
}

/** Super admin only, from the Trash page. */
export async function deleteProject(project: Project): Promise<void> {
  await deleteDoc(doc(getDb(), PROJECTS, project.id));
}
