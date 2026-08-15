"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { QUOTATION_STATUS_COLOR, QUOTATION_STATUS_LABEL, QUOTATION_STATUSES, type QuotationStatus } from "@/lib/constants";
import { subscribeQuotations } from "@/lib/db/quotations";
import { canManageQuotations } from "@/lib/permissions";
import type { Quotation } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function QuotationsPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">("");

  useEffect(() => subscribeQuotations({}, setRows), []);

  const filtered = useMemo(
    () => (rows ?? []).filter((q) => !statusFilter || q.status === statusFilter),
    [rows, statusFilter],
  );

  const stats = useMemo(() => {
    const all = rows ?? [];
    const open = all.filter((q) => !["REJECTED", "EXPIRED", "CONVERTED"].includes(q.status));
    const value = open.reduce((a, q) => a + q.totals.grandTotal, 0);
    const accepted = all.filter((q) => q.status === "ACCEPTED" || q.status === "CONVERTED").length;
    return { total: all.length, open: open.length, value, accepted };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Client-facing quotes for chargers and EPC services — separate from the internal charger catalogue."
        actions={(
          <>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | "")}
              options={QUOTATION_STATUSES.map((s) => ({ value: s, label: QUOTATION_STATUS_LABEL[s] }))}
              placeholder="All statuses"
            />
            {canManageQuotations(viewer) && (
              <Link href="/quotations/new">
                <Button variant="primary"><Plus className="h-4 w-4" /> New quotation</Button>
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total quotations" value={stats.total} />
        <StatCard label="Open" value={stats.open} tone={stats.open ? "positive" : "default"} />
        <StatCard label="Accepted / converted" value={stats.accepted} tone="positive" />
        <StatCard label="Open pipeline value" value={formatINR(stats.value)} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="h-8 w-8" />}
          title="No quotations yet"
          description={canManageQuotations(viewer) ? "Create one for a client who wants chargers or an EPC service." : undefined}
          action={canManageQuotations(viewer) ? (
            <Link href="/quotations/new"><Button variant="primary"><Plus className="h-4 w-4" /> New quotation</Button></Link>
          ) : undefined}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Quote #</th>
                <th className="th">Client</th>
                <th className="th">Lead</th>
                <th className="th">Status</th>
                <th className="th text-right">Total</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-ink-50">
                  <td className="td font-medium">
                    <Link href={`/quotations/${q.id}`} className="text-brand-600 hover:underline">{q.quoteNumber}</Link>
                  </td>
                  <td className="td">
                    <p className="font-medium text-ink-800">{q.client.name}</p>
                    {q.client.company && <p className="text-xs text-ink-500">{q.client.company}</p>}
                  </td>
                  <td className="td text-ink-600">{q.leadCode ?? "—"}</td>
                  <td className="td"><Badge className={QUOTATION_STATUS_COLOR[q.status]}>{QUOTATION_STATUS_LABEL[q.status]}</Badge></td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(q.totals.grandTotal)}</td>
                  <td className="td text-ink-600">{formatDate(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
