"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Printer, RefreshCw, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { PayslipDocument } from "@/components/payslip-document";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSettings } from "@/hooks/use-settings";
import {
  MONTH_LABEL, PAYSLIP_STATUSES, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL, type PayslipStatus,
} from "@/lib/constants";
import {
  computeLossOfPay, deletePayslip, regeneratePayslip, subscribePayslip, updatePayslipDraft, updatePayslipStatus,
} from "@/lib/db/payroll";
import { canManagePayroll, isSuperAdmin } from "@/lib/permissions";
import type { Payslip } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor, role } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [payslip, setPayslip] = useState<Payslip | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [absentDays, setAbsentDays] = useState(0);
  const [halfDays, setHalfDays] = useState(0);
  const [lossOfPay, setLossOfPay] = useState(0);
  const [tds, setTds] = useState(0);
  const [otherDeduction, setOtherDeduction] = useState(0);
  const [miscDeduction, setMiscDeduction] = useState(0);

  useEffect(() => subscribePayslip(id, (row) => {
    setPayslip(row);
    if (row) {
      setAbsentDays(row.absentDays); setHalfDays(row.halfDays); setLossOfPay(row.lossOfPay);
      setTds(row.tds); setOtherDeduction(row.otherDeduction); setMiscDeduction(row.miscDeduction);
    }
  }), [id]);
  useDocumentTitle(payslip ? `Payslip · ${payslip.number}` : undefined);

  // Absent/half-day edits recompute Loss of Pay live, the same way the
  // "Recompute" button next to it does — but only for edits AFTER the
  // payslip has loaded, so the saved (possibly hand-overridden) LOP value
  // on the page isn't silently clobbered the instant it loads.
  const skipAutoLop = useRef(true);
  useEffect(() => { skipAutoLop.current = true; }, [payslip?.id]);
  useEffect(() => {
    if (skipAutoLop.current) { skipAutoLop.current = false; return; }
    if (!payslip) return;
    setLossOfPay(computeLossOfPay(payslip.grossEarning, payslip.monthDays, absentDays, halfDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absentDays, halfDays]);

  const canManage = canManagePayroll(viewer);
  const superAdmin = !!role && isSuperAdmin(role);
  const isDraft = payslip?.status === "DRAFT";
  const canDelete = payslip ? (payslip.status === "DRAFT" || superAdmin) : false;

  if (!canManage) {
    return <EmptyState title="Finance / management access only" description="Payroll is visible to Finance and Admins only." />;
  }
  if (payslip === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (payslip === null) return <EmptyState title="Payslip not found" />;

  if (printMode) {
    return <PayslipDocument payslip={payslip} company={settings.company} onClose={() => setPrintMode(false)} />;
  }

  const previewPaidDays = Math.max(0, payslip.monthDays - absentDays - halfDays * 0.5);
  const previewTotalDeductions = payslip.epfEmployee + payslip.esicEmployee + tds + otherDeduction + miscDeduction + lossOfPay;
  const previewNetPay = payslip.grossEarning - previewTotalDeductions;

  async function saveDraft() {
    if (!payslip || !actor) return;
    await run(() => updatePayslipDraft(payslip, { absentDays, halfDays, lossOfPay, tds, otherDeduction, miscDeduction }, actor), "Payslip updated.");
  }

  async function changeStatus(status: PayslipStatus) {
    if (!payslip || !actor) return;
    await run(() => updatePayslipStatus(payslip, status, actor), `Marked ${PAYSLIP_STATUS_LABEL[status]}.`);
  }

  async function regenerate() {
    if (!payslip || !actor) return;
    await run(() => regeneratePayslip(payslip, actor), "Payslip regenerated from current attendance & salary profile.");
  }

  async function confirmDelete() {
    if (!payslip || !actor) return;
    await run(async () => {
      await deletePayslip(payslip, actor);
      router.push("/payroll");
    }, "Payslip deleted.");
  }

  return (
    <>
      <PageHeader
        title={payslip.number}
        description={`${payslip.employeeName} · ${MONTH_LABEL[payslip.month - 1]} ${payslip.year}`}
        actions={
          <>
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
            {isDraft && (
              <Button loading={busy} title="Recompute from current attendance & salary profile" onClick={() => void regenerate()}>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Select
              value={payslip.status}
              onChange={(e) => void changeStatus(e.target.value as PayslipStatus)}
              options={PAYSLIP_STATUSES.map((s) => ({ value: s, label: PAYSLIP_STATUS_LABEL[s] }))}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Employee">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Name</dt><dd className="text-ink-900">{payslip.employeeName}</dd></div>
              <div><dt className="text-xs text-ink-500">Designation</dt><dd className="text-ink-900">{payslip.designation || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">PF No.</dt><dd className="text-ink-900">{payslip.pfNo || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">UAN No.</dt><dd className="text-ink-900">{payslip.uanNo || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">E.S.I No.</dt><dd className="text-ink-900">{payslip.esiNo || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Salary Account No.</dt><dd className="text-ink-900">{payslip.bankAccountNo || "—"}</dd></div>
            </dl>
          </Card>

          <Card title="Attendance" subtitle="Absent and half-day counts drive the Loss-of-Pay deduction below — correct them here before finalizing.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Month days"><Input value={payslip.monthDays} disabled /></Field>
              <Field label="Absent days" hint="Editable while the payslip is a draft.">
                <Input type="number" min={0} max={payslip.monthDays} step={1} value={absentDays} onChange={(e) => setAbsentDays(Number(e.target.value))} disabled={!isDraft} />
              </Field>
              <Field label="Half days" hint="Each counts as 0.5 of a paid day.">
                <Input type="number" min={0} max={payslip.monthDays} step={1} value={halfDays} onChange={(e) => setHalfDays(Number(e.target.value))} disabled={!isDraft} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-ink-500">Paid days: <span className="tabular-nums font-medium text-ink-800">{isDraft ? previewPaidDays : payslip.paidDays}</span> / {payslip.monthDays}</p>
          </Card>

          <Card title="Earnings" subtitle="Full monthly salary structure — days not worked are deducted below as Loss of Pay, not prorated away here.">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-200"><tr><th className="th">Component</th><th className="th text-right">Salary structure</th><th className="th text-right">Payout</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {[
                    ["Basic", payslip.basic], ["H.R.A.", payslip.hra], ["T.A.", payslip.ta],
                    ["Others", payslip.others], ["Misc.", payslip.misc],
                  ].map(([label, amt]) => (
                    <tr key={label as string}><td className="td">{label}</td><td className="td text-right tabular-nums text-ink-500">—</td><td className="td text-right tabular-nums">{formatINR(amt as number)}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="td">Total</td><td className="td" /><td className="td text-right tabular-nums">{formatINR(payslip.grossEarning)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Deductions" subtitle="EPF/ESIC are computed from the salary profile; Loss of Pay, TDS and other/misc are editable while draft.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E.P.F."><Input value={formatINR(payslip.epfEmployee)} disabled /></Field>
              <Field label="E.S.I.C."><Input value={formatINR(payslip.esicEmployee)} disabled /></Field>
              <Field label="Loss of Pay" hint="Computed from absent/half days above — directly overridable.">
                <div className="flex gap-2">
                  <Input type="number" min={0} value={lossOfPay} onChange={(e) => setLossOfPay(Number(e.target.value))} disabled={!isDraft} className="flex-1" />
                  {isDraft && (
                    <Button type="button" onClick={() => setLossOfPay(computeLossOfPay(payslip.grossEarning, payslip.monthDays, absentDays, halfDays))} title="Recompute from absent/half days">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="TDS"><Input type="number" min={0} value={tds} onChange={(e) => setTds(Number(e.target.value))} disabled={!isDraft} /></Field>
              <Field label="Other"><Input type="number" min={0} value={otherDeduction} onChange={(e) => setOtherDeduction(Number(e.target.value))} disabled={!isDraft} /></Field>
              <Field label="Misc"><Input type="number" min={0} value={miscDeduction} onChange={(e) => setMiscDeduction(Number(e.target.value))} disabled={!isDraft} /></Field>
            </div>
          </Card>

          <Card title="Additional (ER) — employer contributions" subtitle="Informational only, not netted against the employee's pay.">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">E.P.F.</dt><dd className="tabular-nums text-ink-900">{formatINR(payslip.epfEmployer)}</dd></div>
              <div><dt className="text-xs text-ink-500">E.S.I.C.</dt><dd className="tabular-nums text-ink-900">{formatINR(payslip.esicEmployer)}</dd></div>
              <div><dt className="text-xs text-ink-500">Gratuity</dt><dd className="tabular-nums text-ink-900">{formatINR(payslip.gratuity)}</dd></div>
              <div><dt className="text-xs text-ink-500">Bonus</dt><dd className="tabular-nums text-ink-900">{formatINR(payslip.bonus)}</dd></div>
              <div><dt className="text-xs text-ink-500">Health</dt><dd className="tabular-nums text-ink-900">{formatINR(payslip.health)}</dd></div>
            </dl>
          </Card>

          {isDraft && (
            <Button variant="primary" loading={busy} onClick={() => void saveDraft()}>Save changes</Button>
          )}
        </div>

        <div>
          <Card title="Totals" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Gross salary</dt><dd className="tabular-nums">{formatINR(payslip.grossEarning)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Total deductions</dt><dd className="tabular-nums text-rose-600">−{formatINR(isDraft ? previewTotalDeductions : payslip.totalDeductions)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Net pay</dt><dd className="tabular-nums">{formatINR(isDraft ? previewNetPay : payslip.netPay)}</dd></div>
              <div className="flex justify-between pt-1 text-xs text-ink-500"><dt>CTC</dt><dd className="tabular-nums">{formatINR(payslip.ctc)}</dd></div>
            </dl>
            <div className="mt-4 border-t border-ink-100 pt-3">
              <Badge className={PAYSLIP_STATUS_COLOR[payslip.status]}>{PAYSLIP_STATUS_LABEL[payslip.status]}</Badge>
              {payslip.status === "DRAFT" && (
                <p className="mt-2 text-xs text-ink-500">Only visible to Finance/Admin until finalized — mark it Finalized or Paid above to publish it to the employee's own "My Payslips" view.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={() => router.push("/payroll")}>&larr; Back to Payroll</Button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this payslip?"
        description={
          payslip.status !== "DRAFT"
            ? "This payslip is already finalized/paid — deleting it removes an issued record permanently. It cannot be recovered."
            : "This permanently removes the draft payslip. It cannot be recovered."
        }
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              <Trash2 className="h-4 w-4" /> Delete payslip
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{payslip.number} — {payslip.employeeName}, {formatINR(payslip.netPay)}</p>
      </Modal>
    </>
  );
}
