"use client";

import { Filter, RotateCcw, Search } from "lucide-react";
import { useMemo } from "react";

import { Button, Input, Select } from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { useAuth } from "@/components/auth-provider";
import {
  LEAD_STATUSES, LEAD_TYPES, LEAD_TYPE_LABEL, SOURCES, SOURCE_LABEL, STAGES,
  STAGE_META, STATUS_LABEL,
  type LeadStatus, type LeadType, type Source, type Stage,
} from "@/lib/constants";
import { canSeeAllLeads } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export interface FilterState {
  search: string;
  type: LeadType | "ALL";
  status: LeadStatus | "ALL";
  stages: Stage[];
  sources: Source[];
  ownerId: string;
  city: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  duplicatesOnly: boolean;
}

export const emptyFilters: FilterState = {
  search: "", type: "ALL", status: "ALL", stages: [], sources: [],
  ownerId: "", city: "", from: "", to: "", overdueOnly: false, duplicatesOnly: false,
};

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.search) n++;
  if (f.type !== "ALL") n++;
  if (f.status !== "ALL") n++;
  if (f.stages.length) n++;
  if (f.sources.length) n++;
  if (f.ownerId) n++;
  if (f.city) n++;
  if (f.from || f.to) n++;
  if (f.overdueOnly) n++;
  if (f.duplicatesOnly) n++;
  return n;
}

export function LeadFilterBar({
  value, onChange, expanded, onToggleExpanded, right,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  right?: React.ReactNode;
}) {
  const { role } = useAuth();
  const { users } = useAgents();
  const showOwner = role ? canSeeAllLeads(role) : false;

  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...value, [k]: v });

  const toggleStage = (s: Stage) =>
    set("stages", value.stages.includes(s) ? value.stages.filter((x) => x !== s) : [...value.stages, s]);

  const toggleSource = (s: Source) =>
    set("sources", value.sources.includes(s) ? value.sources.filter((x) => x !== s) : [...value.sources, s]);

  const count = useMemo(() => activeFilterCount(value), [value]);

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search name, phone, lead code, city…"
            className="pl-9"
          />
        </div>

        <Select
          value={value.status}
          onChange={(e) => set("status", e.target.value as FilterState["status"])}
          className="w-auto"
          options={[
            { value: "ALL", label: "All statuses" },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          ]}
        />

        <Select
          value={value.type}
          onChange={(e) => set("type", e.target.value as FilterState["type"])}
          className="w-auto"
          options={[
            { value: "ALL", label: "All types" },
            ...LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] })),
          ]}
        />

        <Button onClick={onToggleExpanded} className={cn(count > 0 && "border-brand-400 text-brand-700")}>
          <Filter className="h-4 w-4" />
          Filters{count > 0 ? ` (${count})` : ""}
        </Button>

        {count > 0 && (
          <Button variant="ghost" onClick={() => onChange(emptyFilters)} title="Clear all filters">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}

        {right}
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-ink-200 p-4">
          <div>
            <p className="label">Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => {
                const on = value.stages.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStage(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                      on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-300 hover:bg-ink-50",
                    )}
                  >
                    {STAGE_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="label">Source</p>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => {
                const on = value.sources.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSource(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                      on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-600 ring-ink-300 hover:bg-ink-50",
                    )}
                  >
                    {SOURCE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {showOwner && (
              <div>
                <p className="label">Agent</p>
                <Select
                  placeholder="All agents"
                  value={value.ownerId}
                  onChange={(e) => set("ownerId", e.target.value)}
                  options={users.map((u) => ({ value: u.uid, label: u.name }))}
                />
              </div>
            )}
            <div>
              <p className="label">City</p>
              <Input value={value.city} onChange={(e) => set("city", e.target.value)} placeholder="Nagpur" />
            </div>
            <div>
              <p className="label">Created from</p>
              <Input type="date" value={value.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div>
              <p className="label">Created to</p>
              <Input type="date" value={value.to} onChange={(e) => set("to", e.target.value)} />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={value.overdueOnly}
              onChange={(e) => set("overdueOnly", e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Only leads with an overdue follow-up
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={value.duplicatesOnly}
              onChange={(e) => set("duplicatesOnly", e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Only duplicate leads — same phone, email, GSTIN or PAN as another lead
          </label>
        </div>
      )}
    </div>
  );
}
