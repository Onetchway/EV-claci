"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { PROFORMA_INVOICE_STATUS_COLOR, PROFORMA_INVOICE_STATUS_LABEL, PROFORMA_INVOICE_STATUSES, type ProformaInvoiceStatus } from "@/lib/constants";
import { subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import { canManageProformaInvoices } from "@/lib/permissions";
import type { ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProformaInvoicesPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProformaInvoiceStatus | "">("");

  useEffect(() => subscribeProformaInvoices({}, setRows), []);

  const filtered = useMemo(
    () => (rows ?? []).filter((pi) => !statusFilter || pi.status === statusFilter),
    [rows, statusFilter],
  );

  const stats = useMemo(() => {
    const all = rows ?? [];
    const open = all.filter((pi) => !["REJECTED", "EXPIRED", "CONVERTED"].includes(pi.status));
    const value = open.reduce((a, pi) => a + pi.totals.grandTotal, 0);
    const accepted = all.filter((pi) => pi.status === "ACCEPTED" || pi.status === "CONVERTED").length;
    return { total: all.length, open: open.length, value, accepted };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Proforma Invoices"
        description="Formal pre-sale bills for chargers and EPC services — sent ahead of the tax invoice so a client can arrange payment."
        actions={(
          <>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProformaInvoiceStatus | "")}
              options={PROFORMA_INVOICE_STATUSES.map((s) => ({ value: s, label: PROFORMA_INVOICE_STATUS_LABEL[s] }))}
              placeholder="All statuses"
            />
            {canManageProformaInvoices(viewer) && (
              <Link href="/proforma-invoices/new">
                <Button variant="primary"><Plus className="h-4 w-4" /> New proforma invoice</Button>
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total proforma invoices" value={stats.total} />
        <StatCard label="Open" value={stats.open} tone={stats.open ? "positive" : "default"} />
        <StatCard label="Accepted / converted" value={stats.accepted} tone="positive" />
        <StatCard label="Open pipeline value" value={formatINR(stats.value)} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No proforma invoices yet"
          description={canManageProformaInvoices(viewer) ? "Create one for a client who needs a formal bill ahead of the tax invoice." : undefined}
          action={canManageProformaInvoices(viewer) ? (
            <Link href="/proforma-invoices/new"><Button variant="primary"><Plus className="h-4 w-4" /> New proforma invoice</Button></Link>
          ) : undefined}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">PI #</th>
                <th className="th">Client</th>
                <th className="th">Lead</th>
                <th className="th">Status</th>
                <th className="th text-right">Total</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((pi) => (
                <tr key={pi.id} className="hover:bg-ink-50">
                  <td className="td font-medium">
                    <Link href={`/proforma-invoices/${pi.id}`} className="text-brand-600 hover:underline">{pi.piNumber}</Link>
                  </td>
                  <td className="td">
                    <p className="font-medium text-ink-800">{pi.client.name}</p>
                    {pi.client.company && <p className="text-xs text-ink-500">{pi.client.company}</p>}
                  </td>
                  <td className="td text-ink-600">{pi.leadCode ?? "—"}</td>
                  <td className="td"><Badge className={PROFORMA_INVOICE_STATUS_COLOR[pi.status]}>{PROFORMA_INVOICE_STATUS_LABEL[pi.status]}</Badge></td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(pi.totals.grandTotal)}</td>
                  <td className="td text-ink-600">{formatDate(pi.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
