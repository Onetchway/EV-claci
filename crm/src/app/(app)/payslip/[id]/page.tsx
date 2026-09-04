"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Button, EmptyState, Spinner, useAsyncAction } from "@/components/ui";
import { PrintDocument, PrintFooter, PrintHeader } from "@/components/print-letterhead";
import { useSettings } from "@/hooks/use-settings";
import { amountInWords } from "@/lib/loi-template";
import { publishPayslip, subscribePayslip, subscribeSalaryProfile } from "@/lib/db/payroll";
import { canManagePayroll } from "@/lib/permissions";
import type { Payslip, SalaryProfile } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [payslip, setPayslip] = useState<Payslip | null | undefined>(undefined);
  const [profile, setProfile] = useState<SalaryProfile | null>(null);

  useEffect(() => subscribePayslip(id, setPayslip), [id]);
  useEffect(() => {
    if (!payslip) return;
    return subscribeSalaryProfile(payslip.uid, setProfile);
  }, [payslip?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (payslip === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (payslip === null) return <EmptyState title="Payslip not found" />;

  const rows: [string, number][] = [
    ["Basic", payslip.basic], ["HRA", payslip.hra], ["TA", payslip.ta], ["Others", payslip.others], ["Misc", payslip.misc],
  ];
  const allDeductionRows: [string, number][] = [
    ["Loss of Pay", payslip.lopAmount], ["PF", payslip.pfDeduction], ["ESI", payslip.esiDeduction],
    ["TDS", payslip.tds], ["Other deductions", payslip.otherDeductions],
  ];
  const deductionRows = allDeductionRows.filter(([, v]) => v > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-navy-900">{payslip.payslipNumber}</h1>
          <p className="text-sm text-ink-500">{payslip.userName} — {payslip.month}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManagePayroll(viewer) && payslip.status === "DRAFT" && actor && (
            <Button variant="primary" loading={busy} onClick={() => void run(() => publishPayslip(payslip.id, actor), "Payslip published.")}>
              Publish
            </Button>
          )}
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
        </div>
      </div>

      <article className="loi-sheet mx-auto max-w-2xl bg-white p-6 text-sm text-ink-900 shadow-card print:p-0 print:shadow-none">
        <PrintDocument
          header={<PrintHeader company={settings.company} docLabel="Payslip" docNumber={payslip.payslipNumber} />}
          footer={<PrintFooter company={settings.company} />}
        >
          <h2 className="text-center text-base font-bold uppercase tracking-wide text-ink-900">Payslip — {payslip.month}</h2>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><span className="text-ink-500">Employee</span></div>
            <div className="text-right font-medium">{payslip.userName}</div>
            {profile?.pan && (<><div><span className="text-ink-500">PAN</span></div><div className="text-right">{profile.pan}</div></>)}
            {profile?.uan && (<><div><span className="text-ink-500">UAN</span></div><div className="text-right">{profile.uan}</div></>)}
            <div><span className="text-ink-500">Paid days</span></div>
            <div className="text-right">{payslip.paidDays} / {payslip.totalDays}</div>
            {payslip.lopDays > 0 && (<><div><span className="text-ink-500">Loss of pay days</span></div><div className="text-right">{payslip.lopDays}</div></>)}
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Earnings</th>
                <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-right text-xs font-semibold text-white">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="border border-ink-300 px-3 py-1.5">{label}</td>
                  <td className="border border-ink-300 px-3 py-1.5 text-right tabular-nums">{formatINR(value)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border border-ink-300 px-3 py-1.5">Gross earnings</td>
                <td className="border border-ink-300 px-3 py-1.5 text-right tabular-nums">{formatINR(payslip.grossEarnings)}</td>
              </tr>
            </tbody>
          </table>

          {deductionRows.length > 0 && (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-ink-300 bg-ink-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Deductions</th>
                  <th className="border border-ink-300 bg-ink-700 px-3 py-1.5 text-right text-xs font-semibold text-white">Amount</th>
                </tr>
              </thead>
              <tbody>
                {deductionRows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="border border-ink-300 px-3 py-1.5">{label}</td>
                    <td className="border border-ink-300 px-3 py-1.5 text-right tabular-nums">−{formatINR(value)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="border border-ink-300 px-3 py-1.5">Total deductions</td>
                  <td className="border border-ink-300 px-3 py-1.5 text-right tabular-nums">−{formatINR(payslip.totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div className="mt-3 flex justify-between border-t-2 border-ink-800 pt-2 text-base font-bold">
            <span>Net Pay</span>
            <span className="tabular-nums">{formatINR(payslip.netPay)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-500">{amountInWords(payslip.netPay)}</p>

          {profile?.bankAccountName && (
            <div className="mt-4 text-xs text-ink-500">
              <p className="font-semibold text-ink-700">Bank details</p>
              <p>{profile.bankAccountName} — {profile.bankName} — {profile.accountNumber} — {profile.ifsc}</p>
            </div>
          )}

          <p className="mt-6 text-center text-[10px] text-ink-500">
            This is a computer-generated payslip and does not require a signature. Generated {formatDate(payslip.createdAt)}.
          </p>
        </PrintDocument>
      </article>
    </div>
  );
}
