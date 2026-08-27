"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useAuth } from "@/components/auth-provider";
import { ExportButton } from "@/components/data-transfer";
import {
  Avatar, Button, Card, EmptyState, Input, PageHeader, ProgressBar, Select,
  Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import { agentPerformance, computeTotals, sourceBreakdown } from "@/lib/analytics";
import { STAGES, STAGE_META } from "@/lib/constants";
import { AGENT_COLUMNS } from "@/lib/exports";
import { isAdmin } from "@/lib/permissions";
import { formatCompactINR, formatINR, toDate } from "@/lib/utils";

type Range = "30" | "90" | "365" | "ALL";
type SortKey = "wonValue" | "eoiSigned" | "won";

const SORT_LABEL: Record<SortKey, string> = {
  wonValue: "Closed value", eoiSigned: "EOI signed", won: "Leads closed",
};

export default function AgentsPage() {
  const { role } = useAuth();
  const [range, setRange] = useState<Range>("90");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("wonValue");

  const { leads, loading } = useLeads(useMemo(() => ({ max: 8000 }), []));

  const scoped = useMemo(() => {
    if (range === "ALL") return leads;
    const cutoff = Date.now() - Number(range) * 86_400_000;
    return leads.filter((l) => (toDate(l.createdAt)?.getTime() ?? 0) >= cutoff);
  }, [leads, range]);

  const perf = useMemo(() => {
    const rows = [...agentPerformance(scoped)].sort((a, b) => b[sortKey] - a[sortKey] || b.total - a.total);
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter((r) => r.ownerName.toLowerCase().includes(needle)) : rows;
  }, [scoped, search, sortKey]);

  const totals = useMemo(() => computeTotals(scoped), [scoped]);
  const sources = useMemo(() => sourceBreakdown(scoped), [scoped]);

  const stageMatrix = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const l of scoped) {
      if (l.status !== "ACTIVE") continue;
      const row = map.get(l.ownerName) ?? Object.fromEntries(STAGES.map((s) => [s, 0]));
      row[l.stage] = (row[l.stage] ?? 0) + 1;
      map.set(l.ownerName, row);
    }
    return [...map.entries()].map(([name, counts]) => ({ name, ...counts }));
  }, [scoped]);

  if (role && !isAdmin(role)) {
    return (
      <EmptyState
        title="Admins only"
        description="Agent performance reporting is available to admins and super admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }


  const best = perf[0];

  return (
    <>
      <PageHeader
        title="Agent performance"
        description="Who is generating pipeline, who is closing it, and where leads are stalling."
        actions={
          <>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="w-auto"
              options={[
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "365", label: "Last 12 months" },
                { value: "ALL", label: "All time" },
              ]}
            />
            <ExportButton
              filename="livanto-agent-performance"
              sheetName="Agents"
              columns={AGENT_COLUMNS}
              rows={perf}
            />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads in period" value={totals.total} sub={`${totals.active} still active`} />
        <StatCard label="Closed value" value={formatCompactINR(totals.wonValue)} tone="positive" sub={`${totals.won} won`} />
        <StatCard label="Team conversion" value={`${totals.conversionPct}%`} />
        <StatCard
          label={`Top performer · ${SORT_LABEL[sortKey]}`}
          value={best ? best.ownerName.split(" ")[0] : "—"}
          sub={
            best
              ? sortKey === "eoiSigned" ? `${best.eoiSigned} EOI signed`
                : sortKey === "won" ? `${best.won} leads closed`
                  : `${formatCompactINR(best.wonValue)} closed`
              : undefined
          }
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="space-y-4">
          <Card
            title="Leaderboard"
            subtitle={`Sorted by ${SORT_LABEL[sortKey].toLowerCase()}`}
            actions={
              <>
                <Select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="w-auto"
                  options={[
                    { value: "wonValue", label: "Sort: Closed value" },
                    { value: "eoiSigned", label: "Sort: EOI signed" },
                    { value: "won", label: "Sort: Leads closed" },
                  ]}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find an agent"
                  className="w-44"
                />
              </>
            }
          >
            {perf.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No activity in this period.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Agent</th>
                      <th className="th text-right">Leads</th>
                      <th className="th text-right">Active</th>
                      <th className="th text-right">Won</th>
                      <th className="th text-right">Rejected</th>
                      <th className="th w-40">Conversion</th>
                      <th className="th text-right">Pipeline</th>
                      <th className="th text-right">Closed</th>
                      <th className="th text-right">Collected</th>
                      <th className="th text-right">EOI issued</th>
                      <th className="th text-right">EOI signed</th>
                      <th className="th text-right">Avg cycle</th>
                      <th className="th text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {perf.map((a) => (
                      <tr key={a.ownerId} className="hover:bg-ink-50">
                        <td className="td">
                          <Link href={`/leads?owner=${a.ownerId}`} className="flex items-center gap-2 hover:text-brand-700">
                            <Avatar name={a.ownerName} size={26} />
                            <span className="font-medium">{a.ownerName}</span>
                          </Link>
                        </td>
                        <td className="td text-right tabular-nums">{a.total}</td>
                        <td className="td text-right tabular-nums">{a.active}</td>
                        <td className="td text-right tabular-nums text-emerald-700">{a.won}</td>
                        <td className="td text-right tabular-nums text-rose-600">{a.rejected}</td>
                        <td className="td">
                          <span className="flex items-center gap-2">
                            <ProgressBar pct={a.conversionPct} className="w-20" />
                            <span className="tabular-nums text-xs">{a.conversionPct}%</span>
                          </span>
                        </td>
                        <td className="td text-right tabular-nums">{formatCompactINR(a.pipelineValue)}</td>
                        <td className="td text-right font-semibold tabular-nums">{formatCompactINR(a.wonValue)}</td>
                        <td className="td text-right tabular-nums">{formatCompactINR(a.collected)}</td>
                        <td className="td text-right tabular-nums text-ink-500">{a.eoiIssued}</td>
                        <td className="td text-right font-semibold tabular-nums text-brand-700">{a.eoiSigned}</td>
                        <td className="td text-right tabular-nums">{a.avgCycleDays != null ? `${a.avgCycleDays}d` : "—"}</td>
                        <td className={`td text-right tabular-nums ${a.overdue ? "font-semibold text-rose-600" : ""}`}>
                          {a.overdue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Active leads by stage, per agent">
              {stageMatrix.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">Nothing active.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageMatrix} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {STAGES.map((s, i) => (
                        <Bar
                          key={s}
                          dataKey={s}
                          name={STAGE_META[s].short}
                          stackId="a"
                          fill={["#94a3b8", "#0ea5e9", "#6366f1", "#8b5cf6", "#f59e0b", "#f97316", "#10b981"][i]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Source effectiveness" subtitle="Which channels actually convert">
              {sources.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">No data.</p>
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full">
                    <thead className="border-b border-ink-200">
                      <tr>
                        <th className="th">Source</th>
                        <th className="th text-right">Leads</th>
                        <th className="th text-right">Won</th>
                        <th className="th text-right">Rejected</th>
                        <th className="th text-right">Conversion</th>
                        <th className="th text-right">Closed value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {sources.map((s) => (
                        <tr key={s.source}>
                          <td className="td font-medium">{s.label}</td>
                          <td className="td text-right tabular-nums">{s.count}</td>
                          <td className="td text-right tabular-nums">{s.won}</td>
                          <td className="td text-right tabular-nums">{s.rejected}</td>
                          <td className="td text-right tabular-nums">{s.conversionPct}%</td>
                          <td className="td text-right tabular-nums">{formatINR(s.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
