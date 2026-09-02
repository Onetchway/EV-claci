"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gavel, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Input, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { subscribeTenders } from "@/lib/db/tenders";
import { canManageTenders } from "@/lib/permissions";
import { TENDER_STATUSES, TENDER_STATUS_META, type TenderStatus } from "@/lib/constants";
import type { Tender } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

/**
 * Tenders (EPC / Construction) — government/institutional bids, tracked
 * ahead of and independent from a lead's own quotation. Org-wide visible
 * like quotations, not owner-scoped like leads.
 */
export default function TendersPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TenderStatus>("");

  useEffect(
    () => subscribeTenders({}, (r) => { setRows(r); setLoading(false); }, () => setLoading(false)),
    [],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((t) => !status || t.status === status)
      .filter((t) => !needle || [t.tenderCode, t.title, t.clientName, t.tenderNumber, t.department, t.authority]
        .filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, search, status]);

  const stats = useMemo(() => {
    const open = rows.filter((t) => !["AWARDED", "LOST", "CANCELLED"].includes(t.status)).length;
    const awarded = rows.filter((t) => t.status === "AWARDED").length;
    const totalValue = rows.filter((t) => t.status === "AWARDED").reduce((a, t) => a + (t.tenderValue ?? 0), 0);
    return { open, awarded, totalValue };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Tenders"
        description="Government and institutional bids — tracked from prospecting through submission to award."
        actions={canManageTenders(viewer) && (
          <Link href="/tenders/new">
            <Button variant="primary"><Plus className="h-4 w-4" /> New tender</Button>
          </Link>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total tenders" value={rows.length} />
        <StatCard label="In progress" value={stats.open} />
        <StatCard label="Awarded" value={stats.awarded} tone="positive" />
        <StatCard label="Awarded value" value={formatINR(stats.totalValue)} />
      </div>

      <div className="card mb-4 space-y-3 p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tender code, title, client, department…" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | TenderStatus)}
            placeholder="Any status"
            options={TENDER_STATUSES.map((s) => ({ value: s, label: TENDER_STATUS_META[s].label }))}
          />
        </div>
        {status && (
          <button type="button" onClick={() => setStatus("")} className="text-xs font-medium text-brand-700 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-8 w-8" />}
          title="No tenders match these filters"
          description="Try widening the filters, or add a new tender."
          action={canManageTenders(viewer) ? <Link href="/tenders/new"><Button variant="primary"><Plus className="h-4 w-4" /> New tender</Button></Link> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <Link key={t.id} href={`/tenders/${t.id}`} className="card card-pad block transition hover:border-brand-400 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{t.title}</p>
                  <p className="truncate text-xs text-ink-500">{t.tenderCode} · {t.clientName}</p>
                </div>
                <Badge className={TENDER_STATUS_META[t.status].className}>{TENDER_STATUS_META[t.status].label}</Badge>
              </div>

              {(t.department || t.authority || t.location) && (
                <p className="mt-2 truncate text-xs text-ink-500">
                  {[t.department, t.authority, t.location].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                <span>{t.tenderValue ? formatINR(t.tenderValue) : "Value TBD"}</span>
                <span className="shrink-0">{formatDate(t.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
