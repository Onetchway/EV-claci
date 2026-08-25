"use client";

import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where,
} from "firebase/firestore";

import type { SiteReportType } from "../constants";
import { getDb } from "../firebase/client";
import type { SiteReport } from "../types";

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

export async function createSiteReport(draft: SiteReportDraft): Promise<void> {
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
}
