"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { SimpleDocumentFooter, SimpleDocumentHeader, type Company } from "@/components/simple-document";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSettings } from "@/hooks/use-settings";
import {
  MONTH_LABEL, PAYSLIP_STATUSES, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL, type PayslipStatus,
} from "@/lib/constants";
import { subscribePayslip, updatePayslipDraft, updatePayslipStatus } from "@/lib/db/payroll";
import { canManagePayroll } from "@/lib/permissions";
import type { Payslip } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

export default function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [payslip, setPayslip] = useState<Payslip | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);
  const [paidDays, setPaidDays] = useState(0);
  const [tds, setTds] = useState(0);
  const [otherDeduction, setOtherDeduction] = useState(0);
  const [miscDeduction, setMiscDeduction] = useState(0);

  useEffect(() => subscribePayslip(id, (row) => {
    setPayslip(row);
    if (row) {
      setPaidDays(row.paidDays); setTds(row.tds);
      setOtherDeduction(row.otherDeduction); setMiscDeduction(row.miscDeduction);
    }
  }), [id]);
  useDocumentTitle(payslip ? `Payslip · ${payslip.number}` : undefined);

  const canManage = canManagePayroll(viewer);
  const isDraft = payslip?.status === "DRAFT";

  if (!canManage) {
    return <EmptyState title="Finance / management access only" description="Payroll is visible to Finance and Admins only." />;
  }
  if (payslip === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (payslip === null) return <EmptyState title="Payslip not found" />;

  if (printMode) {
    return <PayslipDocument payslip={payslip} company={settings.company} onClose={() => setPrintMode(false)} />;
  }

  const previewTotalDeductions = payslip.epfEmployee + payslip.esicEmployee + tds + otherDeduction + miscDeduction;
  const previewNetPay = payslip.grossEarning - previewTotalDeductions;

  async function saveDraft() {
    if (!payslip || !actor) return;
    await run(() => updatePayslipDraft(payslip, { paidDays, tds, otherDeduction, miscDeduction }, actor), "Payslip updated.");
  }

  async function changeStatus(status: PayslipStatus) {
    if (!payslip || !actor) return;
    await run(() => updatePayslipStatus(payslip, status, actor), `Marked ${PAYSLIP_STATUS_LABEL[status]}.`);
  }

  return (
    <>
      <PageHeader
        title={payslip.number}
        description={`${payslip.employeeName} · ${MONTH_LABEL[payslip.month - 1]} ${payslip.year}`}
        actions={
          <>
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
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

          <Card title="Attendance" subtitle="Paid days drives every earning below by proration — correct it here before finalizing.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Month days"><Input value={payslip.monthDays} disabled /></Field>
              <Field label="Paid days" hint="Editable while the payslip is a draft.">
                <Input type="number" min={0} max={payslip.monthDays} step={0.5} value={paidDays} onChange={(e) => setPaidDays(Number(e.target.value))} disabled={!isDraft} />
              </Field>
            </div>
          </Card>

          <Card title="Earnings">
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

          <Card title="Deductions" subtitle="EPF/ESIC are computed from the salary profile; TDS and other/misc are editable while draft.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E.P.F."><Input value={formatINR(payslip.epfEmployee)} disabled /></Field>
              <Field label="E.S.I.C."><Input value={formatINR(payslip.esicEmployee)} disabled /></Field>
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
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={() => router.push("/payroll")}>&larr; Back to Payroll</Button>
      </div>
    </>
  );
}

const gridCell = "border border-ink-400 px-2 py-1.5";
const gridLabel = "text-[10px] text-ink-500";

function PayslipDocument({ payslip, company, onClose }: { payslip: Payslip; company: Company; onClose: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl bg-white p-4 text-[11px] leading-snug text-ink-900 print:p-0">
        <SimpleDocumentHeader company={company} docLabel="Payslip" docNumber={payslip.number} />

        <p className="mb-2 text-center text-sm font-semibold">
          Payslip for the month of {MONTH_LABEL[payslip.month - 1]} {payslip.year}
        </p>

        <div className="grid grid-cols-2 border border-ink-400">
          <div className={cn(gridCell, "border-r-0")}><p className={gridLabel}>Employee ID</p><p className="font-medium">{payslip.uid.slice(0, 10)}</p></div>
          <div className={gridCell}><p className={gridLabel}>Name</p><p className="font-medium">{payslip.employeeName}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>Department</p><p>{payslip.departmentName || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>Designation</p><p>{payslip.designation || "—"}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>PF No.</p><p>{payslip.pfNo || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>UAN No.</p><p>{payslip.uanNo || "—"}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>E.S.I No.</p><p>{payslip.esiNo || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>Salary Account No.</p><p>{payslip.bankAccountNo || "—"}</p></div>
        </div>

        <div className={cn(gridCell, "border-t-0")}>
          <p className={gridLabel}>Attendance details</p>
          <p>Month Days: <span className="font-medium">{payslip.monthDays}</span> &nbsp;|&nbsp; Paid Days: <span className="font-medium">{payslip.paidDays}</span></p>
        </div>

        <p className="mt-3 mb-1 font-semibold">Payout details (Amount in Rupees)</p>
        <table className="w-full border-collapse border border-ink-400">
          <thead>
            <tr className="text-left">
              <th className={gridCell}>Additions</th>
              <th className={cn(gridCell, "text-right")}>Salary Structure</th>
              <th className={cn(gridCell, "text-right")}>Payout</th>
              <th className={gridCell}>Deduction</th>
              <th className={cn(gridCell, "text-right")}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={gridCell}>Basic</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.basic)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.basic)}</td>
              <td className={gridCell}>E.P.F.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.epfEmployee ? formatINR(payslip.epfEmployee) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>H.R.A.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.hra)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.hra)}</td>
              <td className={gridCell}>E.S.I.C.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.esicEmployee ? formatINR(payslip.esicEmployee) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>T.A.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.ta)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.ta)}</td>
              <td className={gridCell}>TDS</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.tds ? formatINR(payslip.tds) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>Others</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.others)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.others)}</td>
              <td className={gridCell}>OTHER</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.otherDeduction ? formatINR(payslip.otherDeduction) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>Misc.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.misc ? formatINR(payslip.misc) : "—"}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.misc ? formatINR(payslip.misc) : "—"}</td>
              <td className={gridCell}>Misc.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.miscDeduction ? formatINR(payslip.miscDeduction) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={cn(gridCell, "font-medium")}>ADDITIONAL (ER)</td><td className={gridCell} />
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>E.P.F.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.epfEmployer ? formatINR(payslip.epfEmployer) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>E.S.I.C.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.esicEmployer ? formatINR(payslip.esicEmployer) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Gratuity</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.gratuity ? formatINR(payslip.gratuity) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Bonus</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.bonus ? formatINR(payslip.bonus) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Health</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.health ? formatINR(payslip.health) : "—"}</td>
            </tr>
            <tr className="font-semibold">
              <td className={gridCell}>Total</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.grossEarning)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.grossEarning)}</td>
              <td className={gridCell}>Total</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>

        <div className={cn(gridCell, "border-t-0 flex flex-wrap justify-between gap-3")}>
          <p>Gross Salary: <span className="font-semibold">{formatINR(payslip.grossEarning)}</span></p>
          <p>Net Salary/Payout: <span className="font-semibold">{formatINR(payslip.netPay)}</span></p>
        </div>
        <div className={cn(gridCell, "border-t-0")}>
          <p>CTC: <span className="font-semibold">{formatINR(payslip.ctc)}</span></p>
        </div>

        <p className="mt-4 text-center text-[10px] text-ink-500">This is a computer generated payslip and does not require any signature</p>

        <SimpleDocumentFooter company={company} />
      </article>
    </div>
  );
}
