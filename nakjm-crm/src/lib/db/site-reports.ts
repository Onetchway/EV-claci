"use client";

import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { SiteReportType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, SiteReport } from "../types";
import { logActivitySafe } from "./activity";

export const SITE_REPORTS = "siteReports";

function mapReport(id: string, data: Record<string, unknown>): SiteReport {
  return { id, ...(data as Omit<SiteReport, "id">) };
}

export function subscribeSiteReportsForProject(projectId: string, cb: (rows: SiteReport[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SITE_REPORTS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data())).sort((a, b) => (b.reportDate?.seconds ?? 0) - (a.reportDate?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRecentSiteReports(cb: (rows: SiteReport[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), SITE_REPORTS)),
    (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)).slice(0, 8)),
    (err) => onError?.(err as Error),
  );
}

export interface SiteReportDraft {
  projectId: string;
  projectName: string;
  reportedById?: string | null;
  reportedByName?: string;
  reportDate?: Date | null;
  reportType: SiteReportType;
  progressPct: number;
  workDone?: string;
  issues?: string;
  manpowerCount?: number;
  weather?: string;
  visibleToClient?: boolean;
}

export async function createSiteReport(draft: SiteReportDraft, actor?: Actor): Promise<void> {
  const ref = doc(collection(getDb(), SITE_REPORTS));
  await setDoc(ref, {
    projectId: draft.projectId,
    projectName: draft.projectName,
    reportedById: draft.reportedById ?? null,
    reportedByName: draft.reportedByName ?? "",
    reportDate: draft.reportDate ? Timestamp.fromDate(draft.reportDate) : Timestamp.now(),
    reportType: draft.reportType,
    progressPct: draft.progressPct,
    workDone: draft.workDone ?? "",
    issues: draft.issues ?? "",
    manpowerCount: draft.manpowerCount ?? 0,
    weather: draft.weather ?? "",
    visibleToClient: draft.visibleToClient ?? false,
    createdAt: serverTimestamp(),
  });
  if (actor) {
    logActivitySafe({
      entityType: "SITE_REPORT", entityId: ref.id, entityLabel: draft.projectName, action: "CREATE",
      message: `Submitted a ${draft.reportType.toLowerCase()} site report for ${draft.projectName}`, actor, projectId: draft.projectId,
    });
  }
}

export type SiteReportPatch = Partial<Omit<SiteReportDraft, "projectId" | "projectName" | "reportedById" | "reportedByName">>;

export async function updateSiteReport(report: SiteReport, patch: SiteReportPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.reportType !== undefined) update.reportType = patch.reportType;
  if (patch.progressPct !== undefined) update.progressPct = patch.progressPct;
  if (patch.workDone !== undefined) update.workDone = patch.workDone;
  if (patch.issues !== undefined) update.issues = patch.issues;
  if (patch.manpowerCount !== undefined) update.manpowerCount = patch.manpowerCount;
  if (patch.weather !== undefined) update.weather = patch.weather;
  if (patch.visibleToClient !== undefined) update.visibleToClient = patch.visibleToClient;
  if (patch.reportDate !== undefined) update.reportDate = patch.reportDate ? Timestamp.fromDate(patch.reportDate) : null;
  await updateDoc(doc(getDb(), SITE_REPORTS, report.id), update);
  logActivitySafe({
    entityType: "SITE_REPORT", entityId: report.id, entityLabel: report.projectName, action: "UPDATE",
    message: `Edited a ${report.reportType.toLowerCase()} site report for ${report.projectName}`, actor, projectId: report.projectId,
  });
}

export async function deleteSiteReport(report: SiteReport, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), SITE_REPORTS, report.id));
  logActivitySafe({
    entityType: "SITE_REPORT", entityId: report.id, entityLabel: report.projectName, action: "DELETE",
    message: `Deleted a ${report.reportType.toLowerCase()} site report for ${report.projectName}`, actor, projectId: report.projectId,
  });
}
