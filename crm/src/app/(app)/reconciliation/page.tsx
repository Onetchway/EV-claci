"use client";

import { useState } from "react";
import { AlertTriangle, Scale, Search } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, StatCard, useToast,
} from "@/components/ui";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getRazorpayTopupsBetween } from "@/lib/db/emsp-users";
import { canManageSettlements } from "@/lib/permissions";
import type { WalletTransaction } from "@/lib/types";
import { downloadCsv, formatDateTime, formatINR } from "@/lib/utils";

interface RazorpayPayment {
  id: string;
  amountInr: number;
  createdAt: number;
  email?: string;
  contact?: string;
}

interface ReconResult {
  missingInCrm: RazorpayPayment[];
  missingInRazorpay: WalletTransaction[];
  amountMismatch: { paymentId: string; razorpayInr: number; crmInr: number }[];
  matched: number;
  truncated: boolean;
}

export default function ReconciliationPage() {
  const viewer = useViewer();
  const canView = canManageSettlements(viewer);
  const { push } = useToast();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReconResult | null>(null);

  if (!canView) {
    return <EmptyState title="Restricted" description="Reconciliation is limited to Finance, Ops and Admin roles." />;
  }

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T23:59:59`);

      const current = getFirebaseAuth().currentUser;
      if (!current) throw new Error("Your session expired. Sign in again.");
      const token = await current.getIdToken();
      const res = await fetch(
        `/api/payments/razorpay/list?from=${Math.floor(fromDate.getTime() / 1000)}&to=${Math.floor(toDate.getTime() / 1000)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);

      const [razorpayPayments, crmTopups] = [body.payments as RazorpayPayment[], await getRazorpayTopupsBetween(fromDate, toDate)];

      const crmByPaymentId = new Map(crmTopups.map((t) => [t.razorpayPaymentId!, t]));
      const razorpayById = new Map(razorpayPayments.map((p) => [p.id, p]));

      const missingInCrm: RazorpayPayment[] = [];
      const amountMismatch: ReconResult["amountMismatch"] = [];
      let matched = 0;

      for (const p of razorpayPayments) {
        const crmTxn = crmByPaymentId.get(p.id);
        if (!crmTxn) {
          missingInCrm.push(p);
        } else if (Math.abs(crmTxn.amountInr - p.amountInr) > 0.5) {
          amountMismatch.push({ paymentId: p.id, razorpayInr: p.amountInr, crmInr: crmTxn.amountInr });
        } else {
          matched += 1;
        }
      }

      const missingInRazorpay = crmTopups.filter((t) => !razorpayById.has(t.razorpayPaymentId!));

      setResult({ missingInCrm, missingInRazorpay, amountMismatch, matched, truncated: !!body.truncated });
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!result) return;
    downloadCsv("reconciliation-report.csv", [
      ["Issue", "Payment ID", "Razorpay Amount (INR)", "CRM Amount (INR)"],
      ...result.missingInCrm.map((p) => ["Missing in CRM", p.id, p.amountInr, ""]),
      ...result.missingInRazorpay.map((t) => ["Missing in Razorpay", t.razorpayPaymentId ?? "", "", t.amountInr]),
      ...result.amountMismatch.map((m) => ["Amount mismatch", m.paymentId, m.razorpayInr, m.crmInr]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Razorpay Reconciliation"
        description="Cross-checks Razorpay's captured payments for a date range against wallet top-ups recorded in the CRM — catches a payment that was captured but never credited, or a mismatched amount."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex items-end">
            <Button variant="primary" loading={busy} onClick={() => void run()}>
              <Search className="h-4 w-4" /> Run reconciliation
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Razorpay's API returns at most 100 payments per call — a range with more than that will be reported as truncated rather than silently incomplete.
        </p>
      </Card>

      {result && (
        <>
          {result.truncated && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> This range has 100+ Razorpay payments — narrow the date range for a complete check.
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Matched" value={result.matched} tone="positive" icon={<Scale className="h-4 w-4" />} />
            <StatCard label="Missing in CRM" value={result.missingInCrm.length} tone={result.missingInCrm.length ? "negative" : "default"} />
            <StatCard label="Missing in Razorpay" value={result.missingInRazorpay.length} tone={result.missingInRazorpay.length ? "warn" : "default"} />
            <StatCard label="Amount mismatches" value={result.amountMismatch.length} tone={result.amountMismatch.length ? "negative" : "default"} />
          </div>

          {result.missingInCrm.length === 0 && result.missingInRazorpay.length === 0 && result.amountMismatch.length === 0 ? (
            <EmptyState icon={<Scale className="h-8 w-8" />} title="Everything reconciles" description="Every captured Razorpay payment in this range matches a CRM wallet top-up." />
          ) : (
            <div className="grid gap-4">
              {result.missingInCrm.length > 0 && (
                <Card
                  title="Missing in CRM"
                  subtitle="Razorpay shows these as captured, but no wallet top-up references them — money was taken but never credited."
                  actions={<Button size="sm" onClick={exportCsv}>Export CSV</Button>}
                >
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr><th className="th">Payment ID</th><th className="th">Contact</th><th className="th text-right">Amount</th><th className="th">Captured</th></tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {result.missingInCrm.map((p) => (
                          <tr key={p.id}>
                            <td className="td font-mono text-xs">{p.id}</td>
                            <td className="td text-ink-600">{p.email ?? p.contact ?? "—"}</td>
                            <td className="td text-right tabular-nums">{formatINR(p.amountInr)}</td>
                            <td className="td text-ink-500">{formatDateTime(new Date(p.createdAt * 1000))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {result.amountMismatch.length > 0 && (
                <Card title="Amount mismatches" subtitle="Same payment ID on both sides, different amounts.">
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr><th className="th">Payment ID</th><th className="th text-right">Razorpay</th><th className="th text-right">CRM</th></tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {result.amountMismatch.map((m) => (
                          <tr key={m.paymentId}>
                            <td className="td font-mono text-xs">{m.paymentId}</td>
                            <td className="td text-right tabular-nums">{formatINR(m.razorpayInr)}</td>
                            <td className="td text-right tabular-nums"><Badge className="bg-rose-100 text-rose-800 ring-rose-200">{formatINR(m.crmInr)}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {result.missingInRazorpay.length > 0 && (
                <Card title="Missing in Razorpay" subtitle="A CRM top-up references a payment ID Razorpay doesn't show as captured in this range — check it wasn't refunded/reversed just after.">
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr><th className="th">Payment ID</th><th className="th text-right">Amount</th><th className="th">Logged</th></tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {result.missingInRazorpay.map((t) => (
                          <tr key={t.id}>
                            <td className="td font-mono text-xs">{t.razorpayPaymentId}</td>
                            <td className="td text-right tabular-nums">{formatINR(t.amountInr)}</td>
                            <td className="td text-ink-500">{formatDateTime(t.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
