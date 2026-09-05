"use client";

import { useEffect, useState } from "react";
import { Printer, Wallet } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { PayslipDocument } from "@/components/payslip-document";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { MONTH_LABEL, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL } from "@/lib/constants";
import { subscribePayslips } from "@/lib/db/payroll";
import type { Payslip } from "@/lib/types";
import { formatINR } from "@/lib/utils";

/**
 * Every employee's own self-service payslip view — deliberately open to any
 * signed-in user (no canManagePayroll gate, no /payroll admin-only nav
 * entry), scoped to their own uid. Only shows a payslip once it's left
 * DRAFT (FINALIZED/PAID) — that transition is the "publish to employee"
 * step an admin takes from the payroll detail page; see the payslips
 * Firestore rule for the matching read condition, and db/payroll.ts's
 * module doc comment for why this reuses the status lifecycle instead of a
 * separate published flag.
 */
export default function MyPayslipsPage() {
  const viewer = useViewer();
  const { settings } = useSettings();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState<Payslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewer.uid) return;
    setLoading(true);
    return subscribePayslips(
      { uid: viewer.uid },
      (rows) => { setPayslips(rows.filter((p) => p.status !== "DRAFT")); setLoading(false); setError(null); },
      (e) => { setLoading(false); setError(e.message); },
    );
  }, [viewer.uid]);

  if (printing) {
    return <PayslipDocument payslip={printing} company={settings.company} onClose={() => setPrinting(null)} />;
  }

  return (
    <>
      <PageHeader title="My Payslips" description="Your own payslips, once Finance/Admin finalizes them for a month." />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : error ? (
        <EmptyState title="Couldn't load your payslips" description={error} />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Payslip</th>
                  <th className="th">Month</th>
                  <th className="th text-right">Gross earning</th>
                  <th className="th text-right">Deductions</th>
                  <th className="th text-right">Net pay</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td font-medium text-ink-900">{p.number}</td>
                    <td className="td">{MONTH_LABEL[p.month - 1]} {p.year}</td>
                    <td className="td text-right tabular-nums">{formatINR(p.grossEarning)}</td>
                    <td className="td text-right tabular-nums text-rose-600">−{formatINR(p.totalDeductions)}</td>
                    <td className="td text-right tabular-nums font-semibold">{formatINR(p.netPay)}</td>
                    <td className="td"><Badge className={PAYSLIP_STATUS_COLOR[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></td>
                    <td className="td text-right">
                      <Button size="sm" onClick={() => setPrinting(p)}><Printer className="h-3.5 w-3.5" /> Print / PDF</Button>
                    </td>
                  </tr>
                ))}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="td py-14 text-center text-ink-400">
                      <Wallet className="mx-auto mb-2 h-6 w-6 text-ink-300" />
                      No payslips have been published to you yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
