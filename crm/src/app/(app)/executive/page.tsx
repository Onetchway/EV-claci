"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, FileSignature, IndianRupee, TrendingUp, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import {
  agentPerformance, computeTotals, monthlyTrend, sourceBreakdown, stageBreakdown,
} from "@/lib/analytics";
import { subscribeProjects } from "@/lib/db/projects";
import { canSeeAllLeads } from "@/lib/permissions";
import { scoreLead } from "@/lib/scoring";
import type { Project } from "@/lib/types";
import { formatCompactINR, toDate } from "@/lib/utils";

type Range = "30" | "90" | "365" | "ALL";
const CHART_COLORS = ["#f0501f", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899"];

export default function ExecutiveDashboardPage() {
  const viewer = useViewer();
  const { role } = useAuth();
  const [range, setRange] = useState<Range>("90");
  const { leads, loading } = useLeads({ max: 8000 });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => subscribeProjects({ max: 3000 }, setProjects), []);

  const scoped = useMemo(() => {
    if (range === "ALL") return leads;
    const cutoff = Date.now() - Number(range) * 86_400_000;
    return leads.filter((l) => (toDate(l.createdAt)?.getTime() ?? 0) >= cutoff);
  }, [leads, range]);

  const totals = useMemo(() => computeTotals(scoped), [scoped]);
  const stages = useMemo(() => stageBreakdown(scoped), [scoped]);
  const sources = useMemo(() => sourceBreakdown(scoped), [scoped]);
  const trend = useMemo(() => monthlyTrend(scoped), [scoped]);
  const agents = useMemo(() => agentPerformance(scoped).slice(0, 8), [scoped]);

  const hotLeads = useMemo(
    () => scoped.filter((l) => l.status === "ACTIVE" && scoreLead(l).band.key === "HOT").length,
    [scoped],
  );
  const pendingProposals = useMemo(
    () => scoped.filter((l) => l.eoi?.status === "ISSUED").length,
    [scoped],
  );
  const overduePayments = useMemo(
    () => scoped.filter((l) => l.status === "WON" && (l.dueAmount ?? 0) > 0).length,
    [scoped],
  );

  const liveFranchises = projects.filter((p) => p.ownership === "FRANCHISE" && p.status === "LIVE").length;
  const sitesInDevelopment = projects.filter((p) => p.status !== "LIVE" && p.status !== "CANCELLED").length;

  if (role && !canSeeAllLeads(viewer)) {
    return (
      <EmptyState
        title="Leadership view only"
        description="The executive dashboard is available to roles that see the whole organisation."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Executive dashboard"
        description="Pipeline, collections and delivery across the whole business."
        actions={
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
        }
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Pipeline" value={formatCompactINR(totals.pipelineValue)} icon={<TrendingUp className="h-4 w-4" />} sub={`${totals.active} active`} />
            <StatCard label="Won" value={formatCompactINR(totals.wonValue)} tone="positive" sub={`${totals.won} deals`} />
            <StatCard label="Collected" value={formatCompactINR(totals.collected)} icon={<IndianRupee className="h-4 w-4" />} sub={`${formatCompactINR(totals.outstanding)} outstanding`} />
            <StatCard label="Hot leads" value={hotLeads} tone={hotLeads ? "positive" : "default"} icon={<Zap className="h-4 w-4" />} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Pending proposals" value={pendingProposals} icon={<FileSignature className="h-4 w-4" />} sub="LOI issued, awaiting response" />
            <StatCard label="Overdue payments" value={overduePayments} tone={overduePayments ? "warn" : "default"} icon={<AlertTriangle className="h-4 w-4" />} sub="Won deals with balance due" />
            <StatCard label="Sites under development" value={sitesInDevelopment} icon={<Building2 className="h-4 w-4" />} />
            <StatCard label="Live franchises" value={liveFranchises} tone="positive" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Revenue trend" subtitle="Won value by month">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactINR(v)} />
                    <Tooltip formatter={(v: number) => formatCompactINR(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="value" name="Won value" stroke="#f0501f" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Pipeline by stage">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stages} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="short" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stages.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Lead source performance">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sources} dataKey="count" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sources.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Salesperson performance" subtitle="Top 8 by closed value">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Agent</th>
                      <th className="th text-right">Won</th>
                      <th className="th text-right">Closed value</th>
                      <th className="th text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {agents.map((a) => (
                      <tr key={a.ownerId}>
                        <td className="td font-medium">{a.ownerName}</td>
                        <td className="td text-right tabular-nums">{a.won}</td>
                        <td className="td text-right tabular-nums">{formatCompactINR(a.wonValue)}</td>
                        <td className="td text-right tabular-nums">{a.conversionPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
