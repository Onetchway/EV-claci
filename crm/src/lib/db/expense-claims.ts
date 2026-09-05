"use client";

/**
 * Expense Management & Reimbursement — an employee-filed ExpenseClaim
 * (travel by bike/car, hotel, daily allowance, other; embedded line items,
 * same reasoning as EoiScheduleRow/AgreementBomRow — small lists, no need
 * for a subcollection) carried through a two-stage SEQUENTIAL approval:
 * manager, then Finance. This is new ground in this codebase — no existing
 * module does two-stage approval — so it deliberately mirrors the closest
 * adjacent precedents rather than inventing a new shape:
 *
 *  - Numbering: nextExpenseClaimNumber() is nextPayslipNumber() verbatim,
 *    just a different counter doc and prefix (LG-EXP-000001).
 *  - DRAFT-editable-only, tiered delete (DRAFT deletable by the owner;
 *    anything past DRAFT needs SUPER_ADMIN): mirrors deletePayslip.
 *  - "Manager decides / Finance decides" scoping: like leaveRequests and
 *    attendanceRequests, the Firestore rule is ROLE-only (canManageHrms()
 *    for the manager stage, canManagePayroll() for the Finance stage) —
 *    this codebase has no rules-side managerId cross-reference anywhere
 *    (see the comment on attendanceRequests in firestore.rules); the
 *    managerId/canSeeAllHrms "my team vs. everyone" narrowing is done
 *    client-side, exactly like ApprovalsTab in (app)/attendance/page.tsx.
 *
 * No-manager-on-file handling: submitExpenseClaim skips straight to
 * PENDING_FINANCE (see its doc comment) rather than blocking submission —
 * a missing org-data field should never be the reason someone can't get
 * reimbursed.
 */

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";

import type { ExpenseCategory, ExpenseClaimStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, AppSettings, ExpenseClaim, ExpenseLineItem } from "../types";
import { logChangeSafe } from "./change-log";

export const EXPENSE_CLAIMS = "expenseClaims";

function mapClaim(id: string, data: Record<string, unknown>): ExpenseClaim {
  return { id, ...(data as Omit<ExpenseClaim, "id">) };
}

async function nextExpenseClaimNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "expenseClaims");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-EXP-${String(next).padStart(6, "0")}`;
  });
}

/** True for the two travel categories, which auto-calculate off km × the org rate rather than a manually-entered amount. */
export function isTravelCategory(category: ExpenseCategory): boolean {
  return category === "TRAVEL_BIKE" || category === "TRAVEL_CAR";
}

/** The org-wide per-km rate for a travel category, from Settings → Expenses. */
export function ratePerKmFor(category: ExpenseCategory, expenseSettings: AppSettings["expense"]): number {
  return category === "TRAVEL_BIKE" ? expenseSettings.ratePerKmBike : expenseSettings.ratePerKmCar;
}

/**
 * A fresh line item for a newly-picked category — auto-fills the current
 * rate/amount for a travel category (km starts at 0, so amount starts at 0
 * too, live-recalculated as km is edited — see recomputeTravelAmount) and
 * prefills DAILY_ALLOWANCE from the org default, both still freely editable
 * afterward, same "auto-fill but overridable" idiom as the CTC split.
 */
export function newExpenseLineItem(category: ExpenseCategory, expenseSettings: AppSettings["expense"], today: string): ExpenseLineItem {
  const base: ExpenseLineItem = { id: crypto.randomUUID(), category, date: today, amount: 0 };
  if (isTravelCategory(category)) return { ...base, km: 0, rateApplied: ratePerKmFor(category, expenseSettings), amount: 0 };
  if (category === "DAILY_ALLOWANCE") return { ...base, amount: expenseSettings.defaultDailyAllowance };
  return base;
}

/** Recomputes a travel line's amount from its km × the CURRENT org rate, re-snapshotting rateApplied — called live as km is edited on a DRAFT claim. Non-travel categories are untouched (manual amount). */
export function recomputeTravelAmount(item: ExpenseLineItem, expenseSettings: AppSettings["expense"]): ExpenseLineItem {
  if (!isTravelCategory(item.category)) return item;
  const rate = ratePerKmFor(item.category, expenseSettings);
  return { ...item, rateApplied: rate, amount: Math.round((item.km ?? 0) * rate) };
}

function sumItems(items: ExpenseLineItem[]): number {
  return items.reduce((sum, i) => sum + (Math.round(i.amount) || 0), 0);
}

export function subscribeMyExpenseClaims(
  uid: string,
  cb: (rows: ExpenseClaim[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), EXPENSE_CLAIMS), where("uid", "==", uid), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapClaim(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** For the approvals queue and monthly reports — every claim, newest first; the caller scopes to "my team" vs. everyone client-side (canSeeAllHrms), same idiom as subscribeAllAttendanceRequests. */
export function subscribeAllExpenseClaims(
  cb: (rows: ExpenseClaim[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), EXPENSE_CLAIMS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapClaim(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeExpenseClaim(
  id: string,
  cb: (row: ExpenseClaim | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), EXPENSE_CLAIMS, id),
    (snap) => cb(snap.exists() ? mapClaim(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

/** Starts a new DRAFT claim (no line items yet) — the employee adds items and saves before submitting. Numbered immediately, same as a generated payslip, so a bookmarked link/audit entry always has a stable reference. */
export async function createExpenseClaim(uid: string, userName: string, month: number, year: number, actor: Actor): Promise<string> {
  const number = await nextExpenseClaimNumber();
  const ref = doc(collection(getDb(), EXPENSE_CLAIMS));
  await setDoc(ref, {
    number, uid, userName, managerId: null,
    month, year, items: [], totalAmount: 0,
    status: "DRAFT" satisfies ExpenseClaimStatus,
    routedDirectToFinance: false,
    managerDecisionAt: null, managerDecisionBy: null, managerNote: "",
    financeDecisionAt: null, financeDecisionBy: null, financeNote: "",
    submittedAt: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: ref.id, entityLabel: `${number} — ${userName}`,
    action: "CREATE", actor,
  });

  return ref.id;
}

/** Replaces a DRAFT (or REJECTED — still editable, see reviseExpenseClaim) claim's line items and recomputes totalAmount. Blocked once submitted. */
export async function saveExpenseClaimItems(claim: ExpenseClaim, items: ExpenseLineItem[], actor: Actor): Promise<void> {
  if (claim.status !== "DRAFT") {
    throw new Error("Only a draft claim can be edited — revise it first if it was rejected.");
  }
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    items,
    totalAmount: sumItems(items),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.number,
    action: "UPDATE", actor,
  });
}

/**
 * DRAFT → PENDING_MANAGER (normal case) or straight to PENDING_FINANCE when
 * the employee has no manager on file — blocking someone from ever being
 * reimbursed over missing org data (nobody set their manager yet) is a worse
 * failure mode than skipping a stage, so this routes around it instead and
 * leaves a visible `routedDirectToFinance` flag/note on the claim so nobody
 * mistakes it for a mistake.
 */
export async function submitExpenseClaim(claim: ExpenseClaim, currentManagerId: string | null | undefined, actor: Actor): Promise<void> {
  if (claim.status !== "DRAFT") throw new Error("This claim isn't a draft.");
  if (claim.items.length === 0) throw new Error("Add at least one line item before submitting.");

  const routedDirectToFinance = !currentManagerId;
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    managerId: currentManagerId ?? null,
    status: (routedDirectToFinance ? "PENDING_FINANCE" : "PENDING_MANAGER") satisfies ExpenseClaimStatus,
    routedDirectToFinance,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.number,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: claim.status, to: routedDirectToFinance ? "PENDING_FINANCE" : "PENDING_MANAGER" }],
  });
}

/** Manager stage: PENDING_MANAGER → PENDING_FINANCE (approve) or REJECTED (reject). Gated in the UI by "own managerId or canSeeAllHrms" — see (app)/expenses/approvals/page.tsx; the Firestore rule itself is role-only (canManageHrms()), same posture as attendanceRequests. */
export async function decideExpenseClaimAsManager(claim: ExpenseClaim, approve: boolean, actor: Actor, note?: string): Promise<void> {
  if (claim.status !== "PENDING_MANAGER") throw new Error("This claim isn't waiting on a manager decision.");
  const status: ExpenseClaimStatus = approve ? "PENDING_FINANCE" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status,
    managerDecisionAt: serverTimestamp(),
    managerDecisionBy: actor,
    managerNote: note ?? "",
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.number,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: claim.status, to: status }],
  });
}

/** Finance stage: PENDING_FINANCE → APPROVED or REJECTED. Gated by canManagePayroll() both client- and rules-side — the same Finance/Admin/Super Admin bar payroll already uses. Approval is the reimbursement decision itself — no separate payment/disbursement tracking, out of scope. */
export async function decideExpenseClaimAsFinance(claim: ExpenseClaim, approve: boolean, actor: Actor, note?: string): Promise<void> {
  if (claim.status !== "PENDING_FINANCE") throw new Error("This claim isn't waiting on a Finance decision.");
  const status: ExpenseClaimStatus = approve ? "APPROVED" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status,
    financeDecisionAt: serverTimestamp(),
    financeDecisionBy: actor,
    financeNote: note ?? "",
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.number,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: claim.status, to: status }],
  });
}

/** REJECTED isn't a dead end: this flips it back to DRAFT so the employee can fix the line items and resubmit through the normal flow. */
export async function reviseExpenseClaim(claim: ExpenseClaim, actor: Actor): Promise<void> {
  if (claim.status !== "REJECTED") throw new Error("Only a rejected claim can be revised.");
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status: "DRAFT" satisfies ExpenseClaimStatus,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.number,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: "REJECTED", to: "DRAFT" }],
  });
}

/** DRAFT-vs-locked two-tier delete, mirroring deletePayslip: the owner may delete their own DRAFT; anything past DRAFT (a claim that reached a manager or Finance) needs SUPER_ADMIN, both here and in the Firestore rule. */
export async function deleteExpenseClaim(claim: ExpenseClaim, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id));

  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: `${claim.number} — ${claim.userName}`,
    action: "DELETE", actor,
  });
}

export async function getExpenseClaim(id: string): Promise<ExpenseClaim | null> {
  const snap = await getDoc(doc(getDb(), EXPENSE_CLAIMS, id));
  return snap.exists() ? mapClaim(snap.id, snap.data()) : null;
}

// --------------------------------------------------------------- reporting

export interface EmployeeExpenseSummary {
  uid: string;
  userName: string;
  claims: ExpenseClaim[];
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
}

/**
 * Employee-wise monthly totals for the Reports view — pure client-side
 * grouping over an already-subscribed month/year-filtered claim list (the
 * same "filter then group in memory" pattern Payroll's own list page uses),
 * so no new Firestore query shape or composite index is needed beyond the
 * uid+createdAt index subscribeMyExpenseClaims already relies on. Shows
 * every claim with its status visible per row, not only APPROVED, so a
 * manager/Finance viewer sees what's pending vs. already reimbursed.
 */
export function summarizeExpensesByEmployee(claims: ExpenseClaim[], month: number, year: number): EmployeeExpenseSummary[] {
  const scoped = claims.filter((c) => c.month === month && c.year === year && c.status !== "DRAFT");
  const byUid = new Map<string, EmployeeExpenseSummary>();
  for (const c of scoped) {
    const row = byUid.get(c.uid) ?? {
      uid: c.uid, userName: c.userName, claims: [],
      totalAmount: 0, approvedAmount: 0, pendingAmount: 0, rejectedAmount: 0,
    };
    row.claims.push(c);
    row.totalAmount += c.totalAmount;
    if (c.status === "APPROVED") row.approvedAmount += c.totalAmount;
    else if (c.status === "REJECTED") row.rejectedAmount += c.totalAmount;
    else row.pendingAmount += c.totalAmount;
    byUid.set(c.uid, row);
  }
  return [...byUid.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}
