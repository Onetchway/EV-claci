"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Plus, Users2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  LeadFilterBar, emptyFilters, type FilterState,
} from "@/components/lead-filters";
import {
  Avatar, Badge, Button, EmptyState, PageHeader, Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import { computeTotals } from "@/lib/analytics";
import {
  SOURCE_LABEL, STAGE_META, STATUS_COLOR, STATUS_LABEL,
  type LeadStatus, type LeadType, type Stage,
} from "@/lib/constants";
import { ExportButton, ImportButton } from "@/components/data-transfer";
import { applyClientFilters, createLead, type LeadDraft } from "@/lib/db/leads";
import { buildLeadDraft } from "@/lib/lead-import";
import { LEAD_COLUMNS, LEAD_IMPORT_COLUMNS } from "@/lib/exports";
import { canCreateLead, canExport } from "@/lib/permissions";
import { describeConfig } from "@/lib/pricing";
import type { Lead } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR, toDate } from "@/lib/utils";

type SortKey = "updatedAt" | "value" | "name" | "stage" | "createdAt";

function LeadRow({ lead }: { lead: Lead }) {
  const stage = STAGE_META[lead.stage];
  const overdue =
    lead.status === "ACTIVE" &&
    (toDate(lead.nextFollowUpAt)?.getTime() ?? Infinity) < Date.now();

  return (
    <tr className="hover:bg-ink-50">
      <td className="td">
        <Link href={`/leads/${lead.id}`} className="block">
          <span className="font-medium text-ink-900 hover:text-brand-700">{lead.client?.name}</span>
          <span className="mt-0.5 block text-xs text-ink-500">
            {lead.code} · {lead.client?.phone}
          </span>
        </Link>
      </td>
      <td className="td">
        <Badge className={stage.color}>{stage.short}</Badge>
        {lead.status !== "ACTIVE" && (
          <Badge className={`ml-1 ${STATUS_COLOR[lead.status]}`}>{STATUS_LABEL[lead.status]}</Badge>
        )}
      </td>
      <td className="td text-ink-600">{lead.type === "SITE" ? "Site" : "Franchise"}</td>
      <td className="td max-w-[220px] truncate text-ink-600" title={describeConfig(lead.config)}>
        {describeConfig(lead.config)}
      </td>
      <td className="td text-right font-medium tabular-nums">{formatINR(lead.value)}</td>
      <td className="td text-right tabular-nums text-ink-600">{formatCompactINR(lead.paidAmount ?? 0)}</td>
      <td className="td text-ink-600">{SOURCE_LABEL[lead.source] ?? lead.source}</td>
      <td className="td text-ink-600">{lead.client?.city}</td>
      <td className="td">
        <span className="flex items-center gap-1.5">
          <Avatar name={lead.ownerName} size={22} />
          <span className="text-ink-700">{lead.ownerName}</span>
        </span>
      </td>
      <td className={`td ${overdue ? "font-semibold text-rose-600" : "text-ink-600"}`}>
        {formatDate(lead.nextFollowUpAt)}
      </td>
      <td className="td text-ink-500">{formatDate(lead.updatedAt)}</td>
    </tr>
  );
}

function LeadsInner() {
  const params = useSearchParams();
  const { role, actor } = useAuth();
  const viewer = useViewer();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<SortKey>("updatedAt");

  // Deep links from the dashboard (?stage=EOI, ?status=REJECTED, ?overdue=1).
  useEffect(() => {
    const stage = params.get("stage") as Stage | null;
    const status = params.get("status") as LeadStatus | null;
    const type = params.get("type") as LeadType | null;
    const overdue = params.get("overdue");
    const owner = params.get("owner");
    if (!stage && !status && !type && !overdue && !owner) return;
    setFilters((f) => ({
      ...f,
      stages: stage ? [stage] : f.stages,
      status: status ?? f.status,
      type: type ?? f.type,
      ownerId: owner ?? f.ownerId,
      overdueOnly: overdue === "1" ? true : f.overdueOnly,
    }));
    if (stage || status || type || overdue || owner) setExpanded(true);
  }, [params]);

  // Type/status narrow the server query; everything else is applied in memory.
  const { leads, loading, error } = useLeads(
    useMemo(
      () => ({
        type: filters.type,
        status: filters.status,
        ownerId: filters.ownerId || undefined,
        max: 500,
      }),
      [filters.type, filters.status, filters.ownerId],
    ),
  );

  const rows = useMemo(() => {
    const filtered = applyClientFilters(leads, {
      stages: filters.stages,
      sources: filters.sources,
      city: filters.city || undefined,
      search: filters.search || undefined,
      from: filters.from ? new Date(filters.from) : null,
      to: filters.to ? new Date(filters.to) : null,
      overdueOnly: filters.overdueOnly,
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "value": return (b.value ?? 0) - (a.value ?? 0);
        case "name": return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
        case "stage": return a.stage.localeCompare(b.stage);
        case "createdAt":
          return (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0);
        default:
          return (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0);
      }
    });
    return sorted;
  }, [leads, filters, sort]);

  const totals = useMemo(() => computeTotals(rows), [rows]);


  return (
    <>
      <PageHeader
        title="Leads"
        description={`${rows.length} of ${leads.length} leads shown.`}
        actions={
          <>
            {canExport(viewer) && (
              <ExportButton
                filename="livanto-leads"
                sheetName="Leads"
                columns={LEAD_COLUMNS}
                rows={rows}
              />
            )}
            {canCreateLead(viewer) && actor && (
              <ImportButton
                title="Import leads"
                templateName="livanto-leads"
                columns={LEAD_IMPORT_COLUMNS}
                buildRow={(get) => buildLeadDraft(get, actor)}
                onCommit={async (drafts, onProgress) => {
                  // Sequential on purpose: each lead takes a code from a
                  // transactional counter, and hammering it in parallel just
                  // makes them retry against each other.
                  for (let i = 0; i < drafts.length; i++) {
                    await createLead(drafts[i]!, actor);
                    onProgress(i + 1);
                  }
                }}
              />
            )}
            <Link href="/leads/new">
              <Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Shown" value={rows.length} sub={`${totals.active} active`} />
        <StatCard label="Pipeline value" value={formatCompactINR(totals.pipelineValue)} />
        <StatCard label="Closed" value={totals.won} sub={formatCompactINR(totals.wonValue)} tone="positive" />
        <StatCard label="Rejected" value={totals.rejected} tone={totals.rejected ? "negative" : "default"} />
      </div>

      <LeadFilterBar
        value={filters}
        onChange={setFilters}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((e) => !e)}
        right={
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input w-auto"
            aria-label="Sort leads"
          >
            <option value="updatedAt">Last updated</option>
            <option value="createdAt">Newest first</option>
            <option value="value">Highest value</option>
            <option value="name">Client name</option>
            <option value="stage">Stage</option>
          </select>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-8 w-8" />}
          title="No leads match these filters"
          description="Try widening the filters, or add a new lead."
          action={<Link href="/leads/new"><Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button></Link>}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Client</th>
                <th className="th">Stage</th>
                <th className="th">Type</th>
                <th className="th">Configuration</th>
                <th className="th text-right">Value</th>
                <th className="th text-right">Collected</th>
                <th className="th">Source</th>
                <th className="th">City</th>
                <th className="th">Agent</th>
                <th className="th">Follow-up</th>
                <th className="th">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((l) => <LeadRow key={l.id} lead={l} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <LeadsInner />
    </Suspense>
  );
}
