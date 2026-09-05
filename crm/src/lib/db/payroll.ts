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
 * creating a second one — payroll numbers should never fork. To fix one
 * employee's payslip for a month, use regeneratePayslip — it recomputes
 * paid days/attendance/gross/deductions from the salary profile and
 * attendance as they stand today, in place (same doc, same number), rather
 * than deleting and re-running the whole month's generation. It only
 * touches a DRAFT payslip; deletePayslip mirrors the DRAFT-vs-locked
 * two-tier authorization used elsewhere in this codebase (deleteEoi,
 * deletePurchaseOrder) — anyone who can manage payroll may delete a DRAFT,
 * but a FINALIZED/PAID one needs SUPER_ADMIN.
 *
 * Publish-to-employee: the employee-visible "My Payslips" self-service view
 * reuses the existing DRAFT → FINALIZED → PAID lifecycle as its publish
 * gate (no separate boolean) — a payslip becomes visible to the employee
 * themselves the moment it leaves DRAFT via updatePayslipStatus. See the
 * payslips Firestore rule for the exact read condition.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PayslipStatus } from "../constants";
import { computeAttendanceBreakdown, getAttendanceMonth } from "./attendance";
import { getDepartments } from "./departments";
import { getDb } from "../firebase/client";
import type { Actor, AppUser, Department, PayrollProfile, Payslip } from "../types";
import { logChangeSafe } from "./change-log";
import { getUser } from "./users";

export const PAYROLL_PROFILES = "payrollProfiles";
export const PAYSLIPS = "payslips";

/** PF wage ceiling used for the employee-side EPF deduction default, ₹15,000/month — the same figure the sample payslip's numbers (94,570 basic → ₹1,800 EPF) work out to at 12%. */
const PF_WAGE_CEILING = 15000;
const DEFAULT_EPF_PCT = 12;

/**
 * One-way convenience split of an ANNUAL CTC (the standard way Indian
 * payroll quotes a package) into the salary structure fields, which are
 * themselves MONTHLY — for the Salary form's "Auto-fill from CTC" button.
 * Basic 50%, HRA 25%, and the remaining 25% split TA 10% / Others 10% /
 * Misc 5% (all percentages of annual CTC), each then divided by 12. Purely
 * a prefill: the form still lets every field be edited by hand afterward,
 * and nothing re-runs this unless the admin explicitly clicks the button
 * again.
 */
export function splitCtcMonthly(annualCtc: number): { basic: number; hra: number; ta: number; others: number; misc: number } {
  const c = Math.max(0, annualCtc) / 12;
  return {
    basic: Math.round(c * 0.5),
    hra: Math.round(c * 0.25),
    ta: Math.round(c * 0.1),
    others: Math.round(c * 0.1),
    misc: Math.round(c * 0.05),
  };
}

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
 * Loss-of-Pay deduction for `absentDays` full-absent days and `halfDays`
 * half-days out of `monthDays`, off a given gross monthly earning — the
 * per-day rate is gross/monthDays, a half-day counting as 0.5 of a day.
 */
export function computeLossOfPay(grossEarning: number, monthDays: number, absentDays: number, halfDays: number): number {
  if (monthDays <= 0) return 0;
  return Math.max(0, Math.round((grossEarning / monthDays) * (Math.max(0, absentDays) + Math.max(0, halfDays) * 0.5)));
}

/**
 * The formula behind the sample payslip's numbers, since generalized to
 * itemize attendance-driven deductions rather than silently baking them
 * into a prorated gross: `basic`..`misc` are the salary structure's full
 * monthly figures (94,570 basic, matching the sample when nobody was
 * absent — full month worked = ₹0 Loss-of-Pay, identical to the old
 * prorate-by-paidDays behavior in that case). Days not worked are instead
 * deducted explicitly as `lossOfPay` (see computeLossOfPay), so it shows as
 * its own line in the deductions breakdown instead of vanishing into a
 * smaller gross figure — `paidDays` becomes a derived display value
 * (monthDays − absentDays − halfDays×0.5), not an independent input.
 * EPF employee deduction defaults to 12% of (full) basic capped at the
 * ₹15,000 PF wage ceiling (94,570 basic → ₹1,800, exactly the sample);
 * employer EPF defaults to mirroring the employee contribution; TDS/other/
 * misc deductions and the ER-side gratuity/bonus/health figures are the
 * profile's flat monthly settings, always editable per payslip before it's
 * finalized. CTC printed is gross earning plus every ER-side addition, so
 * it stays internally consistent with the numbers actually shown (see
 * PayrollProfile.ctc's doc comment for why that can differ from the
 * HR-entered target).
 */
export function computePayslipMoney(
  profile: PayrollProfile,
  monthDays: number,
  absentDays: number,
  halfDays: number,
  lossOfPayOverride?: number,
) {
  const basic = Math.max(0, Math.round(profile.basic || 0));
  const hra = Math.max(0, Math.round(profile.hra || 0));
  const ta = Math.max(0, Math.round(profile.ta || 0));
  const others = Math.max(0, Math.round(profile.others || 0));
  const misc = Math.max(0, Math.round(profile.misc ?? 0));
  const grossEarning = basic + hra + ta + others + misc;

  const paidDays = Math.max(0, monthDays - absentDays - halfDays * 0.5);
  const lossOfPay = lossOfPayOverride ?? computeLossOfPay(grossEarning, monthDays, absentDays, halfDays);

  const epfPct = profile.epfEmployeePct ?? DEFAULT_EPF_PCT;
  const epfEmployee = epfPct > 0 ? Math.round(Math.min(basic, PF_WAGE_CEILING) * (epfPct / 100)) : 0;
  const esicPct = profile.esicEmployeePct ?? 0;
  const esicEmployee = esicPct > 0 ? Math.round(grossEarning * (esicPct / 100)) : 0;
  const tds = Math.max(0, Math.round(profile.tdsMonthly ?? 0));
  const otherDeduction = 0;
  const miscDeduction = 0;
  const totalDeductions = epfEmployee + esicEmployee + tds + otherDeduction + miscDeduction + lossOfPay;
  const netPay = grossEarning - totalDeductions;

  const epfEmployer = Math.max(0, Math.round(profile.epfEmployerAmount ?? epfEmployee));
  const esicEmployer = Math.max(0, Math.round(profile.esicEmployerAmount ?? 0));
  const gratuity = Math.max(0, Math.round(profile.gratuityMonthly ?? 0));
  const bonus = Math.max(0, Math.round(profile.bonusMonthly ?? 0));
  const health = Math.max(0, Math.round(profile.healthMonthly ?? 0));
  const ctc = grossEarning + epfEmployer + esicEmployer + gratuity + bonus + health;

  return {
    basic, hra, ta, others, misc, grossEarning,
    paidDays, absentDays: Math.max(0, absentDays), halfDays: Math.max(0, halfDays),
    epfEmployee, esicEmployee, tds, otherDeduction, miscDeduction, lossOfPay, totalDeductions, netPay,
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
  /** uids skipped because their PayrollProfile.dateOfJoining falls after the end of the target month — they hadn't joined yet. */
  skippedNotYetJoined: string[];
}

/** departmentId -> name lookup, built once per generation batch (see getDepartments's doc comment) rather than re-read per employee. */
function departmentNameOf(departments: Department[], departmentId: string | null | undefined): string {
  if (!departmentId) return "";
  return departments.find((d) => d.id === departmentId)?.name ?? "";
}

/**
 * Attendance-driven absent/half-day counts for one employee's payslip
 * month — skipped entirely for anyone exempt from check-in/out
 * (AppUser.attendanceRequired === false): they're treated as fully paid
 * with no attendance lookup at all, matching how the app never expects
 * them to punch in the first place. Shared by generatePayrollForMonth and
 * regeneratePayslip so both apply the exemption the same way.
 */
async function attendanceBreakdownFor(
  uid: string, attendanceRequired: boolean | undefined, year: number, month: number, monthDays: number,
): Promise<{ absentDays: number; halfDays: number }> {
  if (attendanceRequired === false) return { absentDays: 0, halfDays: 0 };
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(monthDays).padStart(2, "0")}`;
  const records = await getAttendanceMonth(uid, monthStart, monthEnd);
  const breakdown = computeAttendanceBreakdown(records, year, month, monthDays);
  return { absentDays: breakdown.absentDays, halfDays: breakdown.halfDays };
}

/**
 * One DRAFT payslip per active employee with an active PayrollProfile, for
 * the given month — skipping anyone who already has a payslip for that
 * month (see the module doc comment for why) or who hadn't joined yet as of
 * that month (PayrollProfile.dateOfJoining after the month's last day; an
 * unset dateOfJoining is treated as always-eligible, the same lenient
 * default used elsewhere in this module). Pass `options.uids` to restrict
 * generation to a specific subset of employees (still applying the same
 * eligibility checks) instead of every active salary profile — e.g. the
 * Payroll page's "Generate for selected employees" action. Attendance is
 * fetched and reduced per employee (no aggregate collection exists yet, see
 * computeAttendanceBreakdown in db/attendance.ts) so this does one query
 * per eligible employee; fine at CRM-scale headcounts, not meant for
 * thousands of rows. Department names are resolved once per run (getDepartments)
 * and mapped locally, not re-read per employee.
 */
export async function generatePayrollForMonth(
  month: number, year: number, actor: Actor, options?: { uids?: string[] },
): Promise<GeneratePayrollResult> {
  const monthDays = new Date(year, month, 0).getDate();
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [profilesSnap, existingSnap, departments] = await Promise.all([
    getDocs(query(collection(getDb(), PAYROLL_PROFILES), where("active", "==", true))),
    getDocs(query(collection(getDb(), PAYSLIPS), where("month", "==", month), where("year", "==", year))),
    getDepartments(),
  ]);
  let profiles = profilesSnap.docs.map((d) => mapProfile(d.id, d.data()));
  if (options?.uids?.length) {
    const wanted = new Set(options.uids);
    profiles = profiles.filter((p) => wanted.has(p.uid));
  }
  const existingUids = new Set(existingSnap.docs.map((d) => (d.data().uid as string)));

  const result: GeneratePayrollResult = { created: 0, skippedExisting: [], skippedNoProfile: 0, skippedNotYetJoined: [] };

  for (const profile of profiles) {
    if (existingUids.has(profile.uid)) { result.skippedExisting.push(profile.uid); continue; }

    const doj = profile.dateOfJoining?.toDate?.();
    if (doj && doj > monthEnd) { result.skippedNotYetJoined.push(profile.uid); continue; }

    const user: AppUser | null = await getUser(profile.uid);
    if (!user) { result.skippedNoProfile++; continue; }

    const { absentDays, halfDays } = await attendanceBreakdownFor(profile.uid, user.attendanceRequired, year, month, monthDays);
    const money = computePayslipMoney(profile, monthDays, absentDays, halfDays);
    const number = await nextPayslipNumber();

    const ref = doc(collection(getDb(), PAYSLIPS));
    await setDoc(ref, {
      number,
      uid: profile.uid,
      employeeName: user.name,
      employeeCode: user.employeeCode ?? null,
      designation: user.designation ?? "",
      departmentName: departmentNameOf(departments, user.departmentId),
      panNo: profile.panNo ?? "",
      uanNo: profile.uanNo ?? "",
      pfNo: profile.pfNo ?? "",
      esiNo: profile.esiNo ?? "",
      bankAccountNo: profile.bankAccountNo ?? "",
      month, year, monthDays,
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

/**
 * Recomputes one DRAFT payslip's attendance and money from the employee's
 * salary profile + current attendance, in place — same doc id and payslip
 * number, so a bookmarked link or an audit trail entry still resolves.
 * This is the "Regenerate" action: for "I generated the whole month too
 * early / attendance has since changed," rather than the older
 * delete-then-rerun-the-month workaround. Blocked once the payslip has
 * left DRAFT — a FINALIZED/PAID payslip is a record that was already
 * handed off, not a scratchpad; delete it (deletePayslip) and let the next
 * Generate payroll run create a fresh one if it's genuinely wrong.
 */
export async function regeneratePayslip(payslip: Payslip, actor: Actor): Promise<void> {
  if (payslip.status !== "DRAFT") {
    throw new Error(`${payslip.number} is ${payslip.status.toLowerCase()} and can no longer be regenerated — delete it and generate a fresh payslip instead.`);
  }

  const profile = await getPayrollProfile(payslip.uid);
  if (!profile) throw new Error("This employee no longer has a salary profile.");

  const [user, departments] = await Promise.all([getUser(payslip.uid), getDepartments()]);
  const { absentDays, halfDays } = await attendanceBreakdownFor(payslip.uid, user?.attendanceRequired, payslip.year, payslip.month, payslip.monthDays);
  const money = computePayslipMoney(profile, payslip.monthDays, absentDays, halfDays);

  await updateDoc(doc(getDb(), PAYSLIPS, payslip.id), {
    employeeName: user?.name ?? payslip.employeeName,
    employeeCode: user?.employeeCode ?? payslip.employeeCode ?? null,
    designation: user?.designation ?? payslip.designation ?? "",
    departmentName: user ? departmentNameOf(departments, user.departmentId) : (payslip.departmentName ?? ""),
    panNo: profile.panNo ?? "",
    uanNo: profile.uanNo ?? "",
    pfNo: profile.pfNo ?? "",
    esiNo: profile.esiNo ?? "",
    bankAccountNo: profile.bankAccountNo ?? "",
    ...money,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PAYSLIP", entityId: payslip.id, entityLabel: payslip.number,
    action: "UPDATE", actor,
  });
}

/**
 * DRAFT-vs-locked two-tier delete, mirroring deleteEoi/deletePurchaseOrder:
 * a DRAFT payslip is a scratchpad and anyone who can manage payroll may
 * remove it; a FINALIZED/PAID one is an issued record and the UI only
 * offers this to a SUPER_ADMIN (also enforced in the payslips Firestore
 * rule, not just here).
 */
export async function deletePayslip(payslip: Payslip, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), PAYSLIPS, payslip.id));

  logChangeSafe({
    entityType: "PAYSLIP", entityId: payslip.id, entityLabel: `${payslip.number} — ${payslip.employeeName}`,
    action: "DELETE", actor,
  });
}

/**
 * Manual edit of the deduction fields a payslip exposes before it's
 * finalized — absentDays/halfDays (itemized attendance counts) and
 * lossOfPay (its computed deduction, directly overridable the same way
 * tds/otherDeduction/miscDeduction already are) alongside TDS/other/misc.
 * paidDays is derived (monthDays − absentDays − halfDays×0.5), not a
 * separate input. Everything else is derived and recomputed fresh via
 * regeneratePayslip.
 */
export interface PayslipEditableFields {
  absentDays: number;
  halfDays: number;
  lossOfPay: number;
  tds: number;
  otherDeduction: number;
  miscDeduction: number;
}

export async function updatePayslipDraft(payslip: Payslip, patch: PayslipEditableFields, actor: Actor): Promise<void> {
  const paidDays = Math.max(0, payslip.monthDays - patch.absentDays - patch.halfDays * 0.5);
  const totalDeductions = payslip.epfEmployee + payslip.esicEmployee + patch.tds + patch.otherDeduction + patch.miscDeduction + patch.lossOfPay;
  const netPay = payslip.grossEarning - totalDeductions;

  await updateDoc(doc(getDb(), PAYSLIPS, payslip.id), {
    paidDays,
    absentDays: patch.absentDays,
    halfDays: patch.halfDays,
    lossOfPay: patch.lossOfPay,
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
