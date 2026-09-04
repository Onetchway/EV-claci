"use client";

/**
 * Payroll — salary profiles plus one payslip per employee per month.
 * A payslip is a snapshot: generating it reads the salary profile and the
 * month's attendance once and freezes the result, so it never silently
 * drifts if either changes later. Regenerating replaces the snapshot in
 * place rather than deleting/recreating, so a published payslip keeps its
 * number and history.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";

import { ATTENDANCE } from "./attendance";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import { estimateMonthlyTds } from "../tax";
import type { Actor, AttendanceRecord, Payslip, PayslipStatus, SalaryProfile } from "../types";

export const SALARY_PROFILES = "salaryProfiles";
export const PAYSLIPS = "payslips";

function mapSalaryProfile(id: string, data: Record<string, unknown>): SalaryProfile {
  return { id, ...(data as Omit<SalaryProfile, "id">) };
}

function mapPayslip(id: string, data: Record<string, unknown>): Payslip {
  return { id, ...(data as Omit<Payslip, "id">) };
}

function monthBounds(month: string): { from: string; to: string; totalDays: number } {
  const [y, m] = month.split("-").map(Number);
  const totalDays = new Date(y!, m!, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(totalDays).padStart(2, "0")}`, totalDays };
}

// ---------------------------------------------------------------------------
// Salary profiles
// ---------------------------------------------------------------------------

export type SalaryProfileDraft = Omit<SalaryProfile, "id" | "createdAt" | "updatedAt" | "updatedBy">;

export async function upsertSalaryProfile(draft: SalaryProfileDraft, actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), SALARY_PROFILES, draft.uid), {
    ...draft,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeSalaryProfile(uid: string, cb: (row: SalaryProfile | null) => void): () => void {
  return onSnapshot(doc(getDb(), SALARY_PROFILES, uid), (snap) => cb(snap.exists() ? mapSalaryProfile(snap.id, snap.data()) : null));
}

export function subscribeSalaryProfiles(cb: (rows: SalaryProfile[]) => void): () => void {
  return onSnapshot(collection(getDb(), SALARY_PROFILES), (snap) => cb(snap.docs.map((d) => mapSalaryProfile(d.id, d.data()))));
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

async function nextPayslipNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "payslips");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-PS-${String(next).padStart(6, "0")}`;
  });
}

function payslipId(uid: string, month: string): string {
  return `${uid}_${month}`;
}

/** Reads the month's attendance once (not a subscription — generation is a one-shot snapshot) and counts paid vs. LOP days. Week-offs/holidays/WFH/on-leave all count as paid; only ABSENT/HALF_DAY reduce it. */
async function computeAttendanceSnapshot(uid: string, month: string): Promise<{ totalDays: number; paidDays: number; absentDays: number; halfDays: number; lopDays: number }> {
  const { from, to, totalDays } = monthBounds(month);
  const orgId = await getCurrentTenantId();
  const snap = await getDocs(query(
    collection(getDb(), ATTENDANCE),
    where("orgId", "==", orgId), where("uid", "==", uid), where("date", ">=", from), where("date", "<=", to),
  ));
  const rows = snap.docs.map((d) => d.data() as AttendanceRecord);
  const absentDays = rows.filter((r) => r.status === "ABSENT").length;
  const halfDays = rows.filter((r) => r.status === "HALF_DAY").length;
  const lopDays = absentDays + halfDays * 0.5;
  return { totalDays, paidDays: Math.max(0, totalDays - lopDays), absentDays, halfDays, lopDays };
}

/** Generates (or regenerates, if one already exists for this employee/month) a DRAFT payslip from the current salary profile and the month's attendance. */
export async function generatePayslip(profile: SalaryProfile, month: string, actor: Actor): Promise<string> {
  const id = payslipId(profile.uid, month);
  const existingSnap = await getDoc(doc(getDb(), PAYSLIPS, id));
  if (existingSnap.exists() && (existingSnap.data().status as PayslipStatus) === "PUBLISHED") {
    throw new Error("This payslip is already published — nothing to regenerate.");
  }

  const { totalDays, paidDays, absentDays, halfDays, lopDays } = await computeAttendanceSnapshot(profile.uid, month);
  const grossEarnings = profile.basic + profile.hra + profile.ta + profile.others + profile.misc;
  const perDay = totalDays > 0 ? grossEarnings / totalDays : 0;
  const lopAmount = Math.round(perDay * lopDays);

  const pfDeduction = profile.epfEnabled ? Math.round(profile.basic * 0.12) : 0;
  const esiDeduction = profile.esicEnabled && grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
  const tds = profile.monthlyTdsOverride ?? (profile.annualCtc ? estimateMonthlyTds(profile.annualCtc) : 0);
  const totalDeductions = lopAmount + pfDeduction + esiDeduction + tds;
  const netPay = Math.max(0, grossEarnings - totalDeductions);

  const orgId = await getCurrentTenantId();
  const payslipNumber = existingSnap.exists() ? (existingSnap.data().payslipNumber as string) : await nextPayslipNumber();

  await setDoc(doc(getDb(), PAYSLIPS, id), {
    payslipNumber,
    uid: profile.uid,
    userName: profile.userName,
    month,
    status: "DRAFT" as PayslipStatus,
    basic: profile.basic, hra: profile.hra, ta: profile.ta, others: profile.others, misc: profile.misc,
    grossEarnings,
    totalDays, paidDays, absentDays, halfDays, lopDays, lopAmount,
    pfDeduction, esiDeduction, tds, otherDeductions: 0,
    totalDeductions, netPay,
    orgId,
    createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
    createdBy: existingSnap.exists() ? existingSnap.data().createdBy : actor,
    updatedAt: serverTimestamp(),
    publishedAt: null,
    publishedBy: null,
  }, { merge: false });

  return id;
}

export async function publishPayslip(id: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PAYSLIPS, id), {
    status: "PUBLISHED" as PayslipStatus, publishedAt: serverTimestamp(), publishedBy: actor,
  });
}

export async function deletePayslip(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), PAYSLIPS, id));
}

export function subscribePayslip(id: string, cb: (row: Payslip | null) => void): () => void {
  return onSnapshot(doc(getDb(), PAYSLIPS, id), (snap) => cb(snap.exists() ? mapPayslip(snap.id, snap.data()) : null));
}

export function subscribePayslipsForMonth(month: string, cb: (rows: Payslip[]) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), PAYSLIPS), where("orgId", "==", orgId), where("month", "==", month)),
      (snap) => cb(snap.docs.map((d) => mapPayslip(d.id, d.data()))),
    );
  });
  return () => { cancelled = true; unsubscribe(); };
}

/** An employee's own issued payslips ("My Payslips") — published only, newest first. */
export function subscribeMyPayslips(uid: string, cb: (rows: Payslip[]) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(
        collection(getDb(), PAYSLIPS), where("orgId", "==", orgId), where("uid", "==", uid),
        where("status", "==", "PUBLISHED"), orderBy("month", "desc"),
      ),
      (snap) => cb(snap.docs.map((d) => mapPayslip(d.id, d.data()))),
    );
  });
  return () => { cancelled = true; unsubscribe(); };
}

// ---------------------------------------------------------------------------
// Employee IDs — sequential, auto-assigned
// ---------------------------------------------------------------------------

/**
 * Only reserves the next sequential number — writing it onto the user's
 * profile has to go through PATCH /api/users/[uid] (Admin SDK), since
 * Firestore rules only let a user update their own contact fields, not an
 * arbitrary teammate's. See patchUserAccess in (app)/attendance/page.tsx for
 * the same pattern.
 */
export async function nextEmployeeId(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "employeeIds");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `EMP-${String(next).padStart(4, "0")}`;
  });
}
