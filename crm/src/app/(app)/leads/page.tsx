"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  LeadFilterBar, emptyFilters, type FilterState,
} from "@/components/lead-filters";
import {
  Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, Spinner, StatCard,
  useAsyncAction,
} from "@/components/ui";
import { useAgents, useLeads } from "@/hooks/use-leads";
import { computeTotals } from "@/lib/analytics";
import {
  SOURCE_LABEL, STAGE_META, STATUS_COLOR, STATUS_LABEL,
  type LeadStatus, type LeadType, type Stage,
} from "@/lib/constants";
import { BulkReassignButton } from "@/components/bulk-reassign-button";
import { ExportButton, ImportButton } from "@/components/data-transfer";
import { applyClientFilters, createLead, trashLead, type LeadDraft } from "@/lib/db/leads";
import { duplicateLeadIds } from "@/lib/duplicates";
import { buildLeadDraft } from "@/lib/lead-import";
import { LEAD_COLUMNS, LEAD_IMPORT_COLUMNS } from "@/lib/exports";
import { canCreateLead, canExport, canReassign, canTrash, isAdmin } from "@/lib/permissions";
import { describeConfig } from "@/lib/pricing";
import { scoreLead } from "@/lib/scoring";
import type { Lead } from "@/lib/types";
import { formatCompactINR, formatDate, formatDateTime, formatINR, toDate } from "@/lib/utils";

type SortKey = "updatedAt" | "value" | "name" | "stage" | "createdAt";
type ViewMode = "list" | "daily";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DailyGroup {
  key: string;
  date: Date;
  leads: Lead[];
  agents: { name: string; count: number }[];
}

/** Groups leads by the local day their `updatedAt` falls on — a day-by-day log of who touched what, for the whole team or a filtered-down individual. */
function groupByDay(rows: Lead[]): DailyGroup[] {
  const buckets = new Map<string, { date: Date; leads: Lead[] }>();
  for (const l of rows) {
    const d = toDate(l.updatedAt);
    if (!d) continue;
    const key = dayKey(d);
    const bucket = buckets.get(key);
    if (bucket) bucket.leads.push(l);
    else buckets.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), leads: [l] });
  }
  return [...buckets.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ date, leads }) => {
      const sortedLeads = [...leads].sort(
        (a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0),
      );
      const byAgent = new Map<string, number>();
      for (const l of sortedLeads) byAgent.set(l.ownerName, (byAgent.get(l.ownerName) ?? 0) + 1);
      const agents = [...byAgent.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
      return { key: dayKey(date), date, leads: sortedLeads, agents };
    });
}

function DailyUpdatesView({ groups }: { groups: DailyGroup[] }) {
  const agentNames = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) for (const a of g.agents) set.add(a.name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [groups]);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Users2 className="h-8 w-8" />}
        title="No updates in this range"
        description="Nothing matching these filters has been updated yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Daily totals" subtitle="Leads updated per day, per agent — newest first">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Date</th>
                {agentNames.map((name) => <th key={name} className="th text-right">{name}</th>)}
                <th className="th text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {groups.map((g) => {
                const byAgent = new Map(g.agents.map((a) => [a.name, a.count]));
                return (
                  <tr key={g.key} className="hover:bg-ink-50">
                    <td className="td font-medium">{formatDate(g.date)}</td>
                    {agentNames.map((name) => (
                      <td key={name} className="td text-right tabular-nums text-ink-600">
                        {byAgent.get(name) ?? "—"}
                      </td>
                    ))}
                    <td className="td text-right font-semibold tabular-nums">{g.leads.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {groups.map((g, i) => (
        <details key={g.key} className="card overflow-hidden" open={i < 2}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50">
            <span className="text-sm font-semibold text-ink-900">{formatDate(g.date)}</span>
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              {g.agents.map((a) => (
                <Badge key={a.name} className="bg-ink-100 text-ink-700 ring-ink-200">{a.name} · {a.count}</Badge>
              ))}
              <Badge className="bg-brand-100 text-brand-800 ring-brand-200">{g.leads.length} total</Badge>
            </span>
          </summary>
          <div className="overflow-x-auto scroll-thin border-t border-ink-200">
            <table className="w-full">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Client</th>
                  <th className="th">Stage</th>
                  <th className="th">Agent</th>
                  <th className="th text-right">Value</th>
                  <th className="th">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {g.leads.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/leads/${l.id}`} className="block">
                        <span className="font-medium text-ink-900 hover:text-brand-700">{l.client?.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-500">{l.code} · {l.client?.phone}</span>
                      </Link>
                    </td>
                    <td className="td"><Badge className={STAGE_META[l.stage].color}>{STAGE_META[l.stage].short}</Badge></td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={l.ownerName} size={20} />
                        <span className="text-ink-700">{l.ownerName}</span>
                      </span>
                    </td>
                    <td className="td text-right tabular-nums">{formatINR(l.value)}</td>
                    <td className="td text-ink-500">{formatDateTime(l.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
const PAGE_SIZE = 5000;
// Rendering thousands of <tr> rows into the DOM at once is what actually
// makes the page laggy (not the fetch) — stats stay computed over every
// fetched row, but only a manageable slice of them hits the DOM until asked
// for more.
const ROWS_PER_PAGE = 150;

function LeadRow({
  lead, selectable, selected, onToggle, isDuplicate,
}: {
  lead: Lead;
  selectable: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  isDuplicate: boolean;
}) {
  const stage = STAGE_META[lead.stage];
  const score = scoreLead(lead);
  const overdue =
    lead.status === "ACTIVE" &&
    (toDate(lead.nextFollowUpAt)?.getTime() ?? Infinity) < Date.now();

  return (
    <tr className="hover:bg-ink-50">
      {selectable && (
        <td className="td w-8">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(lead.id)}
            aria-label={`Select ${lead.client?.name}`}
          />
        </td>
      )}
      <td className="td">
        <Link href={`/leads/${lead.id}`} className="block">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-ink-900 hover:text-brand-700">{lead.client?.name}</span>
            {isDuplicate && (
              <Badge className="bg-amber-100 text-amber-800" title="Shares a phone, email, GSTIN or PAN with another lead">
                Duplicate
              </Badge>
            )}
          </span>
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
      <td className="td">
        {lead.status === "ACTIVE" && (
          <Badge className={score.band.color} title={score.factors.map((f) => `${f.label} (${f.points > 0 ? "+" : ""}${f.points})`).join(", ")}>
            {score.band.label} · {score.score}
          </Badge>
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

/**
 * The whole filter/sort/view state, round-tripped through one `f` query
 * param — so leaving this page (opening a lead) and coming back via the
 * browser's own Back button lands on the exact same filtered, sorted view
 * instead of resetting to the defaults. Dashboard deep links (?stage=EOI
 * etc., handled separately below) still work since they use different
 * param names and only ever arrive without `f` already set.
 */
function parseUrlState(params: URLSearchParams): { filters: FilterState; sort: SortKey; view: ViewMode } | null {
  const raw = params.get("f");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FilterState>;
    return {
      filters: { ...emptyFilters, ...parsed },
      sort: (params.get("sort") as SortKey | null) ?? "updatedAt",
      view: (params.get("view") as ViewMode | null) ?? "list",
    };
  } catch {
    return null;
  }
}

function LeadsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { role, actor } = useAuth();
  const viewer = useViewer();
  const urlState = useMemo(() => parseUrlState(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<FilterState>(urlState?.filters ?? emptyFilters);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<SortKey>(urlState?.sort ?? "updatedAt");
  const [view, setView] = useState<ViewMode>(urlState?.view ?? "list");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { busy: deleting, run: runDelete } = useAsyncAction();

  // Deep links from the dashboard (?stage=EOI, ?status=REJECTED, ?overdue=1)
  // — skipped when `f` already restored full state (arriving via Back, not a dashboard link).
  useEffect(() => {
    if (urlState) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Keep the URL in sync with the live filter/sort/view state (a plain
  // history replace, no new entries) so leaving this page and coming back
  // via Back restores exactly what was applied — see parseUrlState above.
  useEffect(() => {
    const search = new URLSearchParams();
    search.set("f", JSON.stringify(filters));
    search.set("sort", sort);
    search.set("view", view);
    router.replace(`/leads?${search.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, view]);

  const { users: agents } = useAgents();

  // Type/status narrow the server query; everything else is applied in memory.
  const { leads, loading, error } = useLeads(
    useMemo(
      () => ({
        type: filters.type,
        status: filters.status,
        ownerId: filters.ownerId || undefined,
        max: pageSize,
      }),
      [filters.type, filters.status, filters.ownerId, pageSize],
    ),
  );

  // Reset paging and selection whenever the query itself changes.
  useEffect(() => { setPageSize(PAGE_SIZE); }, [filters.type, filters.status, filters.ownerId]);
  useEffect(() => { setSelected(new Set()); }, [filters, sort]);
  useEffect(() => { setVisibleRows(ROWS_PER_PAGE); }, [filters, sort]);

  const duplicateIds = useMemo(() => duplicateLeadIds(leads), [leads]);

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
    const withDuplicates = filters.duplicatesOnly
      ? filtered.filter((l) => duplicateIds.has(l.id))
      : filtered;

    const sorted = [...withDuplicates];
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
  }, [leads, filters, sort, duplicateIds]);

  // Admins see the whole team's daily activity (still narrowable via the
  // Agent filter above); a Sales Manager or Agent only ever sees their own —
  // that filter isn't optional for them, so it's applied here regardless of
  // whatever the Agent dropdown (built for the List view) happens to hold.
  const canSeeDailyUpdates = role ? isAdmin(role) || role === "SALES_MANAGER" || role === "AGENT" : false;
  const dailyScope = role && !isAdmin(role) ? viewer.uid : null;
  const dailyGroups = useMemo(() => {
    if (!canSeeDailyUpdates) return [];
    const scoped = dailyScope ? rows.filter((l) => l.ownerId === dailyScope) : rows;
    return groupByDay(scoped);
  }, [rows, canSeeDailyUpdates, dailyScope]);
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const canBulkTrash = canTrash(viewer);
  const canLoadMore = !loading && leads.length >= pageSize;
  const shownRows = useMemo(() => rows.slice(0, visibleRows), [rows, visibleRows]);
  const canShowMoreRows = rows.length > visibleRows;

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((s) => {
      if (rows.every((r) => s.has(r.id))) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }

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
            {canReassign(viewer) && <BulkReassignButton />}
            {canCreateLead(viewer) && actor && (
              <ImportButton
                title="Import leads"
                templateName="livanto-leads"
                columns={LEAD_IMPORT_COLUMNS}
                buildRow={(get) => buildLeadDraft(get, actor, agents)}
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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Shown" value={rows.length} sub={`${totals.active} active`} />
        <StatCard label="Pipeline value" value={formatCompactINR(totals.pipelineValue)} />
        <StatCard label="Closed" value={totals.won} sub={formatCompactINR(totals.wonValue)} tone="positive" />
        <StatCard label="Rejected" value={totals.rejected} tone={totals.rejected ? "negative" : "default"} />
        <StatCard
          label="Duplicates"
          value={duplicateIds.size}
          tone={duplicateIds.size ? "negative" : "default"}
          sub={duplicateIds.size ? "Same phone / email / GSTIN / PAN" : "None found"}
        />
      </div>

      <LeadFilterBar
        value={filters}
        onChange={setFilters}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((e) => !e)}
        right={
          <>
            {canSeeDailyUpdates && (
              <div className="flex rounded-lg bg-ink-100 p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 ${view === "list" ? "bg-white shadow-sm font-medium" : "text-ink-500"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView("daily")}
                  className={`rounded-md px-3 py-1.5 ${view === "daily" ? "bg-white shadow-sm font-medium" : "text-ink-500"}`}
                >
                  Daily updates
                </button>
              </div>
            )}
            {view === "list" && (
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
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      {canBulkTrash && selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white">
          <span>{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-ink-300 hover:text-white">
              Clear
            </button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete selected
            </Button>
          </div>
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
      ) : view === "daily" && canSeeDailyUpdates ? (
        <DailyUpdatesView groups={dailyGroups} />
      ) : (
        <>
          <div className="card overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  {canBulkTrash && (
                    <th className="th w-8">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                        onChange={toggleAllVisible}
                        aria-label="Select all shown"
                      />
                    </th>
                  )}
                  <th className="th">Client</th>
                  <th className="th">Stage</th>
                  <th className="th">Score</th>
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
                {shownRows.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    selectable={canBulkTrash}
                    selected={selected.has(l.id)}
                    onToggle={toggleRow}
                    isDuplicate={duplicateIds.has(l.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {canShowMoreRows && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setVisibleRows((n) => n + ROWS_PER_PAGE)}>
                Show {Math.min(ROWS_PER_PAGE, rows.length - visibleRows).toLocaleString("en-IN")} more rows
                ({(rows.length - visibleRows).toLocaleString("en-IN")} already loaded, not yet shown)
              </Button>
            </div>
          )}

          {!canShowMoreRows && canLoadMore && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setPageSize((n) => n + PAGE_SIZE)}>
                Load {PAGE_SIZE.toLocaleString("en-IN")} more
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
        description="Moves them to Trash — they disappear from every list, but an admin can restore them from Trash at any time. Nothing is permanently deleted."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() =>
                void runDelete(async () => {
                  const targets = rows.filter((r) => selected.has(r.id));
                  for (const lead of targets) await trashLead(lead, actor!);
                  setSelected(new Set());
                  setDeleteOpen(false);
                }, "Leads moved to Trash.")
              }
            >
              <Trash2 className="h-4 w-4" /> Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {selected.size} lead{selected.size === 1 ? "" : "s"} selected.
        </p>
      </Modal>
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
