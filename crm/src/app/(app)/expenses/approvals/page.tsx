"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, FileText, Wallet, XCircle } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Modal, Select, Spinner, StatCard, Textarea, useAsyncAction,
} from "@/components/ui";
import { EXPENSE_CLAIM_STATUS_COLOR, EXPENSE_CLAIM_STATUS_LABEL, MONTH_LABEL } from "@/lib/constants";
import {
  decideExpenseClaimAsFinance, decideExpenseClaimAsManager, subscribeAllExpenseClaims,
  summarizeExpensesByEmployee,
} from "@/lib/db/expense-claims";
import { subscribeUsers } from "@/lib/db/users";
import { canManageHrms, canManagePayroll, canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, ExpenseClaim } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

const TABS = ["Approvals", "Reports"] as const;
type Tab = (typeof TABS)[number];

/**
 * The manager + Finance approval queue, and (as a second tab on the same
 * page rather than a third route — reads cleaner once actually built) the
 * employee-wise/team-wise monthly report. Gated to "signed in" at the nav
 * level (see lib/page-access.ts's /expenses entry, which this route
 * inherits) — a plain employee with no reports and no Finance role just
 * sees two empty views, which is simpler than a bespoke visibility gate and
 * matches ApprovalsTab's own posture in (app)/attendance/page.tsx.
 */
export default function ExpenseApprovalsPage() {
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const [tab, setTab] = useState<Tab>("Approvals");

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [decisionTarget, setDecisionTarget] = useState<{ claim: ExpenseClaim; stage: "MANAGER" | "FINANCE"; approve: boolean } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => subscribeAllExpenseClaims((r) => { setClaims(r); setLoading(false); }, () => setLoading(false)), []);
  useEffect(() => subscribeUsers(setUsers), []);

  const seesAll = canSeeAllHrms(viewer);
  const isManager = canManageHrms(viewer);
  const isFinance = canManagePayroll(viewer);

  const directReportIds = useMemo(
    () => new Set(users.filter((u) => u.managerId === viewer.uid).map((u) => u.uid)),
    [users, viewer.uid],
  );

  // "My team" for a plain manager, everyone for canSeeAllHrms — same scoping
  // idiom as ApprovalsTab in (app)/attendance/page.tsx.
  const managerScoped = useMemo(
    () => claims.filter((c) => c.status === "PENDING_MANAGER" && (seesAll || directReportIds.has(c.uid))),
    [claims, seesAll, directReportIds],
  );
  const financeQueue = useMemo(() => claims.filter((c) => c.status === "PENDING_FINANCE"), [claims]);
  const decided = useMemo(
    () => claims.filter((c) => c.status === "APPROVED" || c.status === "REJECTED")
      .filter((c) => seesAll || directReportIds.has(c.uid) || c.uid === viewer.uid)
      .slice(0, 100),
    [claims, seesAll, directReportIds, viewer.uid],
  );

  async function decide() {
    if (!decisionTarget) return;
    const { claim, stage, approve } = decisionTarget;
    if (stage === "MANAGER") await decideExpenseClaimAsManager(claim, approve, actor, note);
    else await decideExpenseClaimAsFinance(claim, approve, actor, note);
    setDecisionTarget(null);
    setNote("");
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Expense Approvals &amp; Reports</h1>
        <p className="mt-1 text-sm text-ink-500">
          Decide claims waiting on you as a manager or as Finance, and see employee/team monthly expense totals.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Approvals" && (
        <div className="space-y-4">
          {!isManager && !isFinance && (
            <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
              You have no direct reports and aren't part of Finance/Admin, so there's nothing here to
              decide yet. This page still shows the outcome of any claim of your own that's been decided.
            </p>
          )}

          {isManager && (
            <Card title="Awaiting your decision as manager" subtitle={`${managerScoped.length} pending`}>
              {loading ? (
                <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
              ) : managerScoped.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">Nothing pending.</p>
              ) : (
                <ClaimTable
                  claims={managerScoped}
                  onApprove={(c) => setDecisionTarget({ claim: c, stage: "MANAGER", approve: true })}
                  onReject={(c) => setDecisionTarget({ claim: c, stage: "MANAGER", approve: false })}
                />
              )}
            </Card>
          )}

          {isFinance && (
            <Card title="Awaiting Finance decision" subtitle={`${financeQueue.length} pending`}>
              {loading ? (
                <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
              ) : financeQueue.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">Nothing pending.</p>
              ) : (
                <ClaimTable
                  claims={financeQueue}
                  onApprove={(c) => setDecisionTarget({ claim: c, stage: "FINANCE", approve: true })}
                  onReject={(c) => setDecisionTarget({ claim: c, stage: "FINANCE", approve: false })}
                />
              )}
            </Card>
          )}

          <Card title="Recently decided" subtitle="Most recent first">
            {decided.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">No decisions yet.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Claim</th>
                      <th className="th">Employee</th>
                      <th className="th">Month</th>
                      <th className="th text-right">Total</th>
                      <th className="th">Status</th>
                      <th className="th">Decided by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {decided.map((c) => (
                      <tr key={c.id}>
                        <td className="td font-medium text-ink-900">{c.number}</td>
                        <td className="td">{c.userName}</td>
                        <td className="td text-ink-600">{MONTH_LABEL[c.month - 1]} {c.year}</td>
                        <td className="td text-right tabular-nums">{formatINR(c.totalAmount)}</td>
                        <td className="td"><Badge className={EXPENSE_CLAIM_STATUS_COLOR[c.status]}>{EXPENSE_CLAIM_STATUS_LABEL[c.status]}</Badge></td>
                        <td className="td text-ink-500">{c.financeDecisionBy?.name ?? c.managerDecisionBy?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "Reports" && <ReportsTab claims={claims} loading={loading} seesAll={seesAll} directReportIds={directReportIds} viewerUid={viewer.uid} />}

      <Modal
        open={decisionTarget !== null}
        onClose={() => setDecisionTarget(null)}
        title={decisionTarget ? `${decisionTarget.approve ? "Approve" : "Reject"} ${decisionTarget.claim.number}` : ""}
        description={decisionTarget ? `${decisionTarget.claim.userName} — ${formatINR(decisionTarget.claim.totalAmount)} — ${MONTH_LABEL[decisionTarget.claim.month - 1]} ${decisionTarget.claim.year}` : ""}
        footer={
          <>
            <Button onClick={() => setDecisionTarget(null)}>Cancel</Button>
            <Button variant={decisionTarget?.approve ? "primary" : "danger"} loading={busy} onClick={() => void run(decide, "Decision recorded.")}>
              {decisionTarget?.approve ? "Approve" : "Reject"}
            </Button>
          </>
        }
      >
        {decisionTarget && (
          <div className="space-y-3">
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
              {decisionTarget.claim.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-ink-700">{formatDate(i.date)} — {i.description || i.category}</span>
                  <span className="flex items-center gap-2 tabular-nums text-ink-900">
                    {i.receiptUrl && <a href={i.receiptUrl} target="_blank" rel="noreferrer" title={i.receiptFileName}><FileText className="h-3.5 w-3.5 text-ink-400" /></a>}
                    {formatINR(i.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <Field label="Note" hint="Optional — shown to the employee.">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function ClaimTable({
  claims, onApprove, onReject,
}: { claims: ExpenseClaim[]; onApprove: (c: ExpenseClaim) => void; onReject: (c: ExpenseClaim) => void }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full">
        <thead className="border-b border-ink-200">
          <tr>
            <th className="th">Claim</th>
            <th className="th">Employee</th>
            <th className="th">Month</th>
            <th className="th text-right">Total</th>
            <th className="th">Submitted</th>
            <th className="th text-right">Decision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {claims.map((c) => (
            <tr key={c.id}>
              <td className="td font-medium text-ink-900">
                {c.number}
                {c.routedDirectToFinance && <span className="ml-1.5 block text-[11px] font-normal text-ink-400">no manager on file — sent directly to Finance</span>}
              </td>
              <td className="td">{c.userName}</td>
              <td className="td text-ink-600">{MONTH_LABEL[c.month - 1]} {c.year}</td>
              <td className="td text-right tabular-nums">{formatINR(c.totalAmount)}</td>
              <td className="td text-ink-500">{formatDate(c.submittedAt)}</td>
              <td className="td text-right">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => onApprove(c)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button type="button" onClick={() => onReject(c)} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTab({
  claims, loading, seesAll, directReportIds, viewerUid,
}: { claims: ExpenseClaim[]; loading: boolean; seesAll: boolean; directReportIds: Set<string>; viewerUid: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const canSeeReports = seesAll || directReportIds.size > 0;

  const scopedClaims = useMemo(
    () => (seesAll ? claims : claims.filter((c) => directReportIds.has(c.uid))),
    [claims, seesAll, directReportIds],
  );
  const summary = useMemo(() => summarizeExpensesByEmployee(scopedClaims, month, year), [scopedClaims, month, year]);
  const grandTotal = summary.reduce((s, r) => s + r.totalAmount, 0);

  if (!canSeeReports) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="No team to report on"
        description="This view shows your direct reports' monthly expenses — you don't have any yet. Org-wide reporting is open to Admin, Super Admin and HR."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Month">
          <Select
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            options={MONTH_LABEL.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
        </Field>
        <Field label="Year">
          <Select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
          />
        </Field>
      </div>

      <StatCard label={`Total — ${MONTH_LABEL[month - 1]} ${year}`} value={formatINR(grandTotal)} icon={<Wallet className="h-4 w-4" />} />

      <Card
        title={seesAll ? "Every employee" : "Your team"}
        subtitle="Every submitted claim for the month, by status — not only approved, so you can see what's still pending."
      >
        {loading ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : summary.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">No claims submitted for {MONTH_LABEL[month - 1]} {year}.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Approved</th>
                  <th className="th text-right">Pending</th>
                  <th className="th text-right">Rejected</th>
                  <th className="th text-right">Claims</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {summary.map((row) => (
                  <tr key={row.uid} className={row.uid === viewerUid ? "bg-brand-50/40" : undefined}>
                    <td className="td font-medium text-ink-900">{row.userName}</td>
                    <td className="td text-right tabular-nums font-semibold">{formatINR(row.totalAmount)}</td>
                    <td className="td text-right tabular-nums text-emerald-700">{formatINR(row.approvedAmount)}</td>
                    <td className="td text-right tabular-nums text-amber-700">{formatINR(row.pendingAmount)}</td>
                    <td className="td text-right tabular-nums text-rose-600">{formatINR(row.rejectedAmount)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{row.claims.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
