"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Receipt } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Card, Button, EmptyState, Field, Input, PageHeader, Select, Spinner,
} from "@/components/ui";
import {
  subscribeAllWalletTransactions, subscribeCorporateAccounts, subscribeEmspUsers,
} from "@/lib/db/emsp-users";
import { canManageEmspUsers } from "@/lib/permissions";
import type { CorporateAccount, EmspUser, WalletTransaction } from "@/lib/types";
import { downloadCsv, formatDateTime, formatINR, toDate } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "TOPUP", label: "Top-up" },
  { value: "DEBIT", label: "Debit" },
  { value: "REFUND", label: "Refund" },
];

export default function PaymentsPage() {
  const viewer = useViewer();
  const canView = canManageEmspUsers(viewer);

  const [txns, setTxns] = useState<WalletTransaction[] | null>(null);
  const [users, setUsers] = useState<EmspUser[]>([]);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!canView) return;
    return subscribeAllWalletTransactions(setTxns);
  }, [canView]);
  useEffect(() => subscribeEmspUsers(setUsers), []);
  useEffect(() => subscribeCorporateAccounts(setAccounts), []);

  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const ownerName = (t: WalletTransaction) =>
    t.ownerType === "EMSP_USER" ? userName.get(t.ownerId) ?? t.ownerId : accountName.get(t.ownerId) ?? t.ownerId;

  const filtered = useMemo(() => {
    if (!txns) return [];
    const q = search.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return txns.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      const at = toDate(t.createdAt)?.getTime();
      if (fromTs && (!at || at < fromTs)) return false;
      if (toTs && (!at || at > toTs)) return false;
      if (!q) return true;
      const hay = [ownerName(t), t.razorpayPaymentId, t.razorpayOrderId, t.razorpayRefundId, t.couponCode, t.note]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [txns, typeFilter, search, from, to, userName, accountName]);

  const totals = useMemo(() => {
    let topups = 0, debits = 0, refunds = 0;
    for (const t of filtered) {
      if (t.type === "TOPUP") topups += t.amountInr;
      else if (t.type === "DEBIT") debits += t.amountInr;
      else if (t.type === "REFUND") refunds += t.amountInr;
    }
    return { topups, debits, refunds };
  }, [filtered]);

  function exportCsv() {
    downloadCsv("payment-transactions.csv", [
      ["Date", "Owner", "Type", "Amount (INR)", "Razorpay Payment ID", "Coupon", "Note"],
      ...filtered.map((t) => [
        formatDateTime(t.createdAt), ownerName(t), t.type, t.amountInr,
        t.razorpayPaymentId ?? "", t.couponCode ?? "", t.note ?? "",
      ]),
    ]);
  }

  if (!canView) {
    return (
      <EmptyState
        title="Restricted"
        description="Payment Transactions is limited to Ops, Finance, Support and Admin roles."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Payment Transactions"
        description="Cross-customer wallet ledger — every top-up, session debit, and refund across all drivers and corporate accounts."
        actions={<Button onClick={exportCsv} disabled={filtered.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-ink-500">Top-ups</p><p className="text-xl font-semibold tabular-nums text-emerald-700">{formatINR(totals.topups)}</p></Card>
        <Card><p className="text-xs text-ink-500">Debits</p><p className="text-xl font-semibold tabular-nums text-rose-600">{formatINR(totals.debits)}</p></Card>
        <Card><p className="text-xs text-ink-500">Refunds</p><p className="text-xl font-semibold tabular-nums text-amber-700">{formatINR(totals.refunds)}</p></Card>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Search">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Owner, payment ID, coupon…" />
          </Field>
          <Field label="Type">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={TYPE_OPTIONS} />
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {txns === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="No transactions match" />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Date</th><th className="th">Owner</th><th className="th">Type</th>
                  <th className="th text-right">Amount</th><th className="th">Payment ID</th><th className="th">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="td whitespace-nowrap text-ink-500">{formatDateTime(t.createdAt)}</td>
                    <td className="td">{ownerName(t)}</td>
                    <td className="td">
                      <Badge className={
                        t.type === "TOPUP" ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : t.type === "REFUND" ? "bg-amber-100 text-amber-800 ring-amber-200"
                            : "bg-rose-100 text-rose-800 ring-rose-200"
                      }>
                        {t.type === "TOPUP" ? "Top-up" : t.type === "REFUND" ? "Refund" : "Debit"}
                      </Badge>
                    </td>
                    <td className={`td text-right tabular-nums font-medium ${t.type === "DEBIT" ? "text-rose-600" : "text-emerald-700"}`}>
                      {t.type === "DEBIT" ? "-" : "+"}{formatINR(t.amountInr)}
                    </td>
                    <td className="td font-mono text-xs text-ink-500">{t.razorpayPaymentId ?? t.razorpayRefundId ?? "—"}</td>
                    <td className="td text-ink-600">{t.note ?? (t.couponCode ? `Coupon ${t.couponCode}` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
