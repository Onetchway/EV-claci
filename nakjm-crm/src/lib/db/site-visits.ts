"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { SiteVisitStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, SiteVisit, SiteVisitEngineer } from "../types";
import { logActivitySafe } from "./activity";

export const SITE_VISITS = "siteVisits";

function mapSiteVisit(id: string, data: Record<string, unknown>): SiteVisit {
  return { id, ...(data as Omit<SiteVisit, "id">) };
}

/** NKJM-SV-00001, allocated transactionally so two office staff can't collide. */
async function nextSiteVisitNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "siteVisits");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-SV-${String(seq).padStart(5, "0")}`;
}

export function subscribeSiteVisits(cb: (rows: SiteVisit[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SITE_VISITS)),
    (snap) => cb(snap.docs.map((d) => mapSiteVisit(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSiteVisitsForProject(projectId: string, cb: (rows: SiteVisit[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SITE_VISITS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapSiteVisit(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSiteVisit(id: string, cb: (v: SiteVisit | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), SITE_VISITS, id),
    (snap) => cb(snap.exists() ? mapSiteVisit(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getSiteVisit(id: string): Promise<SiteVisit | null> {
  const snap = await getDoc(doc(getDb(), SITE_VISITS, id));
  return snap.exists() ? mapSiteVisit(snap.id, snap.data()) : null;
}

export interface SiteVisitDraft {
  projectId: string;
  projectName: string;
  siteName?: string;
  locationLink?: string;
  address?: string;
  pocName?: string;
  pocContact?: string;
  pocEmail?: string;
  chargerType?: string;
  scheduledDate?: Date | null;
  status?: SiteVisitStatus;
  assignedEngineers?: SiteVisitEngineer[];
  managerId?: string;
  managerName?: string;
  notes?: string;
}

export async function createSiteVisit(draft: SiteVisitDraft, actor: Actor): Promise<SiteVisit> {
  const visitNo = await nextSiteVisitNo();
  const ref = doc(collection(getDb(), SITE_VISITS));
  const payload = {
    visitNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    siteName: draft.siteName ?? "",
    locationLink: draft.locationLink ?? "",
    address: draft.address ?? "",
    pocName: draft.pocName ?? "",
    pocContact: draft.pocContact ?? "",
    pocEmail: draft.pocEmail ?? "",
    chargerType: draft.chargerType ?? "",
    scheduledDate: draft.scheduledDate ? Timestamp.fromDate(draft.scheduledDate) : null,
    status: draft.status ?? "SCHEDULED",
    assignedEngineers: draft.assignedEngineers ?? [],
    managerId: draft.managerId ?? "",
    managerName: draft.managerName ?? "",
    notes: draft.notes ?? "",
    observations: "",
    observedBy: null,
    observedAt: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "SITE_VISIT", entityId: ref.id, entityLabel: `${visitNo} — ${draft.projectName}`, action: "CREATE",
    message: `Scheduled site visit ${visitNo} for ${draft.projectName}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<SiteVisit, "id">) };
}

export type SiteVisitPatch = Partial<Omit<SiteVisitDraft, "projectId" | "projectName">>;

export async function updateSiteVisit(visit: SiteVisit, patch: SiteVisitPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.siteName !== undefined) update.siteName = patch.siteName;
  if (patch.locationLink !== undefined) update.locationLink = patch.locationLink;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.pocName !== undefined) update.pocName = patch.pocName;
  if (patch.pocContact !== undefined) update.pocContact = patch.pocContact;
  if (patch.pocEmail !== undefined) update.pocEmail = patch.pocEmail;
  if (patch.chargerType !== undefined) update.chargerType = patch.chargerType;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.assignedEngineers !== undefined) update.assignedEngineers = patch.assignedEngineers;
  if (patch.managerId !== undefined) update.managerId = patch.managerId;
  if (patch.managerName !== undefined) update.managerName = patch.managerName;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.scheduledDate !== undefined) update.scheduledDate = patch.scheduledDate ? Timestamp.fromDate(patch.scheduledDate) : null;
  await updateDoc(doc(getDb(), SITE_VISITS, visit.id), update);
  logActivitySafe({
    entityType: "SITE_VISIT", entityId: visit.id, entityLabel: visit.visitNo,
    action: patch.status && patch.status !== visit.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== visit.status ? `status: ${visit.status} → ${patch.status}` : `Edited site visit ${visit.visitNo}`,
    actor, projectId: visit.projectId,
  });
}

/** The engineer's post-visit report — a distinct workflow step from a general edit, so it gets its own activity message and, once filed, moves the visit to COMPLETED. */
export async function submitSiteVisitObservations(visit: SiteVisit, observations: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), SITE_VISITS, visit.id), {
    observations,
    observedBy: actor,
    observedAt: serverTimestamp(),
    status: "COMPLETED",
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "SITE_VISIT", entityId: visit.id, entityLabel: visit.visitNo, action: "STATUS_CHANGE",
    message: `status: ${visit.status} → COMPLETED`, actor, projectId: visit.projectId,
  });
}

export async function deleteSiteVisit(visit: SiteVisit, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), SITE_VISITS, visit.id));
  logActivitySafe({
    entityType: "SITE_VISIT", entityId: visit.id, entityLabel: visit.visitNo, action: "DELETE",
    message: `Deleted site visit ${visit.visitNo}`, actor, projectId: visit.projectId,
  });
}
