"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { subscribeMyPayslips } from "@/lib/db/payroll";
import type { Payslip } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function MyPayslipsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Payslip[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    return subscribeMyPayslips(profile.uid, setRows);
  }, [profile]);

  return (
    <>
      <PageHeader title="My Payslips" description="Payslips issued to you, most recent first." />

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="No payslips yet" description="Issued payslips will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Month</th>
                <th className="th">Payslip No.</th>
                <th className="th text-right">Net pay</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-ink-100">
                  <td className="td font-medium">{p.month}</td>
                  <td className="td text-ink-600">{p.payslipNumber}</td>
                  <td className="td text-right tabular-nums">{formatINR(p.netPay)}</td>
                  <td className="td text-right">
                    <Link href={`/payslip/${p.id}`} className="text-xs font-medium text-brand-700 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
