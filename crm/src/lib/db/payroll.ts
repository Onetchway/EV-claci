"use client";

/**
 * Payroll — an employee's salary structure (PayrollProfile, one per uid) and
 * the monthly Payslips generated from it. Mirrors purchase-orders.ts /
 * proforma-invoices.ts: a Firestore-transaction counter for the human-facing
 * number (LG-PS-000001), a DRAFT status a payslip starts in and can still be
 * corrected, and every write going through logChangeSafe.
 *
 * Duplicate-per-month handling: generatePayrollForMonth SKIPS any employee
 * who already has a payslip for that month/year rather than silently
 * creating a second one — payroll numbers should never fork. To regenerate
 * one employee's payslip for a month, delete the existing DRAFT first (a
 * FINALIZED/PAID one can't be deleted at all — see deletePayslip).
 */

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PayslipStatus } from "../constants";
import { computePaidDays, getAttendanceMonth } from "./attendance";
import { getDb } from "../firebase/client";
import type { Actor, AppUser, PayrollProfile, Payslip } from "../types";
import { logChangeSafe } from "./change-log";
import { getUser } from "./users";

export const PAYROLL_PROFILES = "payrollProfiles";
export const PAYSLIPS = "payslips";

/** PF wage ceiling used for the employee-side EPF deduction default, ₹15,000/month — the same figure the sample payslip's numbers (94,570 basic → ₹1,800 EPF) work out to at 12%. */
const PF_WAGE_CEILING = 15000;
const DEFAULT_EPF_PCT = 12;

function mapProfile(id: string, data: Record<string, unknown>): PayrollProfile {
  return { id, ...(data as Omit<PayrollProfile, "id">) };
}

function mapPayslip(id: string, data: Record<string, unknown>): Payslip {
  return { id, ...(data as Omit<Payslip, "id">) };
}

// --------------------------------------------------------- payroll profiles

export async function getPayrollProfile(uid: string): Promise<PayrollProfile | null> {
  const snap = await getDoc(doc(getDb(), PAYROLL_PROFILES, uid));
  return snap.exists() ? mapProfile(snap.id, snap.data()) : null;
}

export function subscribePayrollProfile(
  uid: string,
  cb: (profile: PayrollProfile | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PAYROLL_PROFILES, uid),
    (snap) => cb(snap.exists() ? mapProfile(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export function subscribePayrollProfiles(
  cb: (rows: PayrollProfile[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), PAYROLL_PROFILES),
    (snap) => cb(snap.docs.map((d) => mapProfile(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export interface PayrollProfileDraft {
  panNo?: string;
  uanNo?: string;
  pfNo?: string;
  esiNo?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  dateOfJoining?: Date | null;
  ctc: number;
  basic: number;
  hra: number;
  ta: number;
  others: number;
  misc?: number;
  epfEmployeePct?: number;
  epfEmployerAmount?: number;
  esicEmployeePct?: number;
  esicEmployerAmount?: number;
  tdsMonthly?: number;
  gratuityMonthly?: number;
  bonusMonthly?: number;
  healthMonthly?: number;
  active: boolean;
}

/** Full overwrite (not a patch) — same reasoning as submitInvestorBankDetails: keeps every write matching one known shape. Doc id == uid, so this is also how a profile gets created the first time. */
export async function setPayrollProfile(uid: string, employeeName: string, draft: PayrollProfileDraft, actor: Actor): Promise<void> {
  const ref = doc(getDb(), PAYROLL_PROFILES, uid);
  const existing = await getDoc(ref);

  await setDoc(ref, {
    uid,
    panNo: draft.panNo ?? "",
    uanNo: draft.uanNo ?? "",
    pfNo: draft.pfNo ?? "",
    esiNo: draft.esiNo ?? "",
    bankAccountName: draft.bankAccountName ?? "",
    bankName: draft.bankName ?? "",
    bankAccountNo: draft.bankAccountNo ?? "",
    bankIfsc: draft.bankIfsc ?? "",
    dateOfJoining: draft.dateOfJoining ? Timestamp.fromDate(draft.dateOfJoining) : null,
    ctc: Math.max(0, Math.round(draft.ctc)),
    basic: Math.max(0, Math.round(draft.basic)),
    hra: Math.max(0, Math.round(draft.hra)),
    ta: Math.max(0, Math.round(draft.ta)),
    others: Math.max(0, Math.round(draft.others)),
    misc: Math.max(0, Math.round(draft.misc ?? 0)),
    epfEmployeePct: draft.epfEmployeePct ?? DEFAULT_EPF_PCT,
    epfEmployerAmount: draft.epfEmployerAmount ?? null,
    esicEmployeePct: draft.esicEmployeePct ?? 0,
    esicEmployerAmount: draft.esicEmployerAmount ?? 0,
    tdsMonthly: draft.tdsMonthly ?? 0,
    gratuityMonthly: draft.gratuityMonthly ?? 0,
    bonusMonthly: draft.bonusMonthly ?? 0,
    healthMonthly: draft.healthMonthly ?? 0,
    active: draft.active,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    createdBy: existing.exists() ? (existing.data().createdBy ?? null) : actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PAYROLL_PROFILE", entityId: uid, entityLabel: `Salary profile — ${employeeName}`,
    action: existing.exists() ? "UPDATE" : "CREATE", actor,
  });
}

// ------------------------------------------------------------------ payslips

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

/**
 * The formula behind the sample payslip's numbers: each earning component is
 * prorated by paidDays/monthDays (full month = no proration, matching the
 * sample where structure and payout are identical); EPF employee deduction
 * defaults to 12% of basic capped at the ₹15,000 PF wage ceiling (94,570
 * basic → ₹1,800, exactly the sample); employer EPF defaults to mirroring
 * the employee contribution; TDS/other/misc deductions and the ER-side
 * gratuity/bonus/health figures are the profile's flat monthly settings,
 * always editable per payslip before it's finalized. CTC printed is
 * gross earning plus every ER-side addition, so it stays internally
 * consistent with the numbers actually shown (see PayrollProfile.ctc's doc
 * comment for why that can differ from the HR-entered target).
 */
export function computePayslipMoney(profile: PayrollProfile, monthDays: number, paidDays: number) {
  const ratio = monthDays > 0 ? Math.min(1, Math.max(0, paidDays / monthDays)) : 0;
  const prorate = (n: number) => Math.round((n || 0) * ratio);

  const basic = prorate(profile.basic);
  const hra = prorate(profile.hra);
  const ta = prorate(profile.ta);
  const others = prorate(profile.others);
  const misc = prorate(profile.misc ?? 0);
  const grossEarning = basic + hra + ta + others + misc;

  const epfPct = profile.epfEmployeePct ?? DEFAULT_EPF_PCT;
  const epfEmployee = epfPct > 0 ? Math.round(Math.min(basic, PF_WAGE_CEILING) * (epfPct / 100)) : 0;
  const esicPct = profile.esicEmployeePct ?? 0;
  const esicEmployee = esicPct > 0 ? Math.round(grossEarning * (esicPct / 100)) : 0;
  const tds = Math.max(0, Math.round(profile.tdsMonthly ?? 0));
  const otherDeduction = 0;
  const miscDeduction = 0;
  const totalDeductions = epfEmployee + esicEmployee + tds + otherDeduction + miscDeduction;
  const netPay = grossEarning - totalDeductions;

  const epfEmployer = Math.max(0, Math.round(profile.epfEmployerAmount ?? epfEmployee));
  const esicEmployer = Math.max(0, Math.round(profile.esicEmployerAmount ?? 0));
  const gratuity = Math.max(0, Math.round(profile.gratuityMonthly ?? 0));
  const bonus = Math.max(0, Math.round(profile.bonusMonthly ?? 0));
  const health = Math.max(0, Math.round(profile.healthMonthly ?? 0));
  const ctc = grossEarning + epfEmployer + esicEmployer + gratuity + bonus + health;

  return {
    basic, hra, ta, others, misc, grossEarning,
    epfEmployee, esicEmployee, tds, otherDeduction, miscDeduction, totalDeductions, netPay,
    epfEmployer, esicEmployer, gratuity, bonus, health, ctc,
  };
}

export function subscribePayslips(
  filters: { uid?: string; month?: number; year?: number; max?: number },
  cb: (rows: Payslip[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = [
    ...(filters.uid ? [where("uid", "==", filters.uid)] : []),
    ...(filters.year != null ? [where("year", "==", filters.year)] : []),
    ...(filters.month != null ? [where("month", "==", filters.month)] : []),
  ];
  return onSnapshot(
    query(collection(getDb(), PAYSLIPS), ...constraints, orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapPayslip(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribePayslip(
  id: string,
  cb: (row: Payslip | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PAYSLIPS, id),
    (snap) => cb(snap.exists() ? mapPayslip(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export interface GeneratePayrollResult {
  created: number;
  skippedExisting: string[];
  skippedNoProfile: number;
}

/**
 * One DRAFT payslip per active employee with an active PayrollProfile, for
 * the given month — skipping anyone who already has a payslip for that
 * month (see the module doc comment for why). Attendance is fetched and
 * reduced per employee (no aggregate collection exists yet, see
 * computePaidDays in db/attendance.ts) so this does one query per eligible
 * employee; fine at CRM-scale headcounts, not meant for thousands of rows.
 */
export async function generatePayrollForMonth(month: number, year: number, actor: Actor): Promise<GeneratePayrollResult> {
  const monthDays = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(monthDays).padStart(2, "0")}`;

  const [profilesSnap, existingSnap] = await Promise.all([
    getDocs(query(collection(getDb(), PAYROLL_PROFILES), where("active", "==", true))),
    getDocs(query(collection(getDb(), PAYSLIPS), where("month", "==", month), where("year", "==", year))),
  ]);
  const profiles = profilesSnap.docs.map((d) => mapProfile(d.id, d.data()));
  const existingUids = new Set(existingSnap.docs.map((d) => (d.data().uid as string)));

  const result: GeneratePayrollResult = { created: 0, skippedExisting: [], skippedNoProfile: 0 };

  for (const profile of profiles) {
    if (existingUids.has(profile.uid)) { result.skippedExisting.push(profile.uid); continue; }

    const user: AppUser | null = await getUser(profile.uid);
    if (!user) { result.skippedNoProfile++; continue; }

    const records = await getAttendanceMonth(profile.uid, monthStart, monthEnd);
    const paidDays = computePaidDays(records, year, month, monthDays);
    const money = computePayslipMoney(profile, monthDays, paidDays);
    const number = await nextPayslipNumber();

    const ref = doc(collection(getDb(), PAYSLIPS));
    await setDoc(ref, {
      number,
      uid: profile.uid,
      employeeName: user.name,
      designation: user.designation ?? "",
      panNo: profile.panNo ?? "",
      uanNo: profile.uanNo ?? "",
      pfNo: profile.pfNo ?? "",
      esiNo: profile.esiNo ?? "",
      bankAccountNo: profile.bankAccountNo ?? "",
      month, year, monthDays, paidDays,
      ...money,
      status: "DRAFT" as PayslipStatus,
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
      finalizedAt: null, finalizedBy: null,
      paidAt: null, paidBy: null,
    });

    logChangeSafe({
      entityType: "PAYSLIP", entityId: ref.id, entityLabel: `${number} — ${user.name}`,
      action: "CREATE", actor,
    });
    result.created++;
  }

  return result;
}

/** Only meaningful while status is DRAFT — recomputes paidDays/money from the profile+attendance as they now stand, for a correction before finalizing. */
export async function recomputePayslip(payslip: Payslip, paidDaysOverride: number | undefined, actor: Actor): Promise<void> {
  const profile = await getPayrollProfile(payslip.uid);
  if (!profile) throw new Error("This employee no longer has a salary profile.");

  const paidDays = paidDaysOverride ?? payslip.paidDays;
  const money = computePayslipMoney(profile, payslip.monthDays, paidDays);

  await updateDoc(doc(getDb(), PAYSLIPS, payslip.id), {
    paidDays, ...money, updatedAt: serverTimestamp(), updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PAYSLIP", entityId: payslip.id, entityLabel: payslip.number,
    action: "UPDATE", actor,
  });
}

/** Manual edit of the deduction/paid-days fields a payslip exposes before it's finalized (TDS, other/misc deduction, paid days) — everything else is derived and recomputed via recomputePayslip. */
export interface PayslipEditableFields {
  paidDays: number;
  tds: number;
  otherDeduction: number;
  miscDeduction: number;
}

export async function updatePayslipDraft(payslip: Payslip, patch: PayslipEditableFields, actor: Actor): Promise<void> {
  const totalDeductions = payslip.epfEmployee + payslip.esicEmployee + patch.tds + patch.otherDeduction + patch.miscDeduction;
  const netPay = payslip.grossEarning - totalDeductions;

  await updateDoc(doc(getDb(), PAYSLIPS, payslip.id), {
    paidDays: patch.paidDays,
    tds: patch.tds,
    otherDeduction: patch.otherDeduction,
    miscDeduction: patch.miscDeduction,
    totalDeductions,
    netPay,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PAYSLIP", entityId: payslip.id, entityLabel: payslip.number,
    action: "UPDATE", actor,
  });
}

export async function updatePayslipStatus(payslip: Payslip, status: PayslipStatus, actor: Actor): Promise<void> {
  const extra: Record<string, unknown> = {};
  if (status === "FINALIZED") { extra.finalizedAt = serverTimestamp(); extra.finalizedBy = actor; }
  if (status === "PAID") { extra.paidAt = serverTimestamp(); extra.paidBy = actor; }

  await updateDoc(doc(getDb(), PAYSLIPS, payslip.id), {
    status, ...extra, updatedAt: serverTimestamp(), updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PAYSLIP", entityId: payslip.id, entityLabel: payslip.number,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: payslip.status, to: status }],
  });
}
