"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";

import {
  Avatar, Badge, Button, EmptyState, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import {
  B2B_LEAD_TYPES, COMMERCIAL_MODEL_LABEL, LEAD_TYPE_LABEL, STAGE_META,
  STATUS_COLOR, STATUS_LABEL, type LeadType,
} from "@/lib/constants";
import { applyClientFilters } from "@/lib/db/leads";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function B2bPage() {
  const [type, setType] = useState<LeadType | "ALL">("ALL");
  const { leads, loading } = useLeads(useMemo(() => ({ max: 3000 }), []));

  const rows = useMemo(
    () => applyClientFilters(leads, { types: type === "ALL" ? B2B_LEAD_TYPES : [type] }),
    [leads, type],
  );

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((l) => l.status === "ACTIVE").length,
    won: rows.filter((l) => l.status === "WON").length,
    value: rows.reduce((a, l) => a + (l.value ?? 0), 0),
  }), [rows]);

  return (
    <>
      <PageHeader
        title="B2B"
        description="Corporate, government, RWA and software-only leads — institutional clients, not individual franchise investors."
        actions={
          <>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as LeadType | "ALL")}
              className="w-auto"
              options={[{ value: "ALL", label: "All B2B types" }, ...B2B_LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))]}
            />
            <Link href="/leads/new">
              <Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="B2B leads" value={stats.total} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Won" value={stats.won} tone="positive" />
        <StatCard label="Pipeline value" value={formatCompactINR(stats.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No B2B leads yet"
          description="Corporate buildings, government bodies, RWAs and software-only clients appear here."
          action={<Link href="/leads/new"><Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button></Link>}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Client</th>
                <th className="th">Type</th>
                <th className="th">Commercial model</th>
                <th className="th">Stage</th>
                <th className="th text-right">Value</th>
                <th className="th">Agent</th>
                <th className="th">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-ink-50">
                  <td className="td">
                    <Link href={`/leads/${l.id}`} className="block">
                      <span className="font-medium text-ink-900 hover:text-brand-700">{l.client?.name}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{l.code} · {l.client?.company || l.client?.city}</span>
                    </Link>
                  </td>
                  <td className="td text-ink-600">{LEAD_TYPE_LABEL[l.type]}</td>
                  <td className="td text-ink-600">{l.commercialModel ? COMMERCIAL_MODEL_LABEL[l.commercialModel].split(" —")[0] : "—"}</td>
                  <td className="td">
                    <Badge className={STAGE_META[l.stage].color}>{STAGE_META[l.stage].short}</Badge>
                    {l.status !== "ACTIVE" && <Badge className={`ml-1 ${STATUS_COLOR[l.status]}`}>{STATUS_LABEL[l.status]}</Badge>}
                  </td>
                  <td className="td text-right font-medium tabular-nums">{formatCompactINR(l.value ?? 0)}</td>
                  <td className="td">
                    <span className="flex items-center gap-1.5">
                      <Avatar name={l.ownerName} size={20} />
                      <span className="text-ink-700">{l.ownerName}</span>
                    </span>
                  </td>
                  <td className="td text-ink-500">{formatDate(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
