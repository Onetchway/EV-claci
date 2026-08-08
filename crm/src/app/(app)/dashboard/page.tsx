"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle, BadgeIndianRupee, CheckCircle2, FileSignature, Plus, TrendingUp,
  Users2, XCircle,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import {
  agentPerformance, chargerDemand, computeTotals, monthlyTrend, sourceBreakdown,
  stageBreakdown,
} from "@/lib/analytics";
import {
  EOI_STATUS_COLOR, EOI_STATUS_LABEL, STAGES, STAGE_META,
} from "@/lib/constants";
import { isAdmin } from "@/lib/permissions";
import { formatCompactINR, formatDate, formatINR, toDate } from "@/lib/utils";

const CHART_COLORS = ["#1cb567", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899"];

export default function DashboardPage() {
  const { profile, role } = useAuth();
  const { leads, loading, error } = useLeads({ max: 500 });

  const totals = useMemo(() => computeTotals(leads), [leads]);
  const stages = useMemo(() => stageBreakdown(leads), [leads]);
  const sources = useMemo(() => sourceBreakdown(leads), [leads]);
  const trend = useMemo(() => monthlyTrend(leads), [leads]);
  const demand = useMemo(() => chargerDemand(leads), [leads]);
  const agents = useMemo(() => agentPerformance(leads).slice(0, 6), [leads]);

  // Letters awaiting action — drafted but not sent, or sent and unanswered.
  const eoiQueue = useMemo(
    () =>
      leads
        .filter((l) => l.eoi && (l.eoi.status === "DRAFT" || l.eoi.status === "ISSUED"))
        .sort((a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0))
        .slice(0, 6),
    [leads],
  );

  // Leads far enough along to deserve a letter but without one yet.
  const eoiCandidates = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.status === "ACTIVE" &&
            !l.eoi &&
            (l.config ?? []).length > 0 &&
            STAGES.indexOf(l.stage) >= STAGES.indexOf("INTRODUCTION"),
        )
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 6),
    [leads],
  );

  const followUps = useMemo(() => {
    const now = Date.now();
    return leads
      .filter((l) => l.status === "ACTIVE" && toDate(l.nextFollowUpAt))
      .sort((a, b) => (toDate(a.nextFollowUpAt)!.getTime()) - (toDate(b.nextFollowUpAt)!.getTime()))
      .slice(0, 8)
      .map((l) => ({ lead: l, overdue: toDate(l.nextFollowUpAt)!.getTime() < now }));
  }, [leads]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-ink-400">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.name?.split(" ")[0] ?? "there"}`}
        description={
          role && isAdmin(role)
            ? "Organisation-wide view across every agent."
            : "Your leads, pipeline and follow-ups."
        }
        actions={
          <Link href="/leads/new">
            <Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          Could not load leads: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open pipeline"
          value={formatCompactINR(totals.pipelineValue)}
          sub={`${totals.active} active · weighted ${formatCompactINR(totals.weightedValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Closed / handed over"
          value={formatCompactINR(totals.wonValue)}
          sub={`${totals.won} leads · avg ${formatCompactINR(totals.avgDealValue)}`}
          tone="positive"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Collected"
          value={formatCompactINR(totals.collected)}
          sub={`${formatCompactINR(totals.outstanding)} still due on won deals`}
          icon={<BadgeIndianRupee className="h-4 w-4" />}
        />
        <StatCard
          label="Conversion"
          value={`${totals.conversionPct}%`}
          sub={`${totals.won} won vs ${totals.rejected} rejected`}
          tone={totals.conversionPct >= 40 ? "positive" : totals.conversionPct >= 20 ? "default" : "warn"}
          icon={<Users2 className="h-4 w-4" />}
        />
      </div>

      {totals.overdueFollowUps > 0 && (
        <Link
          href="/leads?overdue=1"
          className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{totals.overdueFollowUps}</strong> follow-up
            {totals.overdueFollowUps === 1 ? " is" : "s are"} overdue.
          </span>
        </Link>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Pipeline by stage" subtitle="Live leads only" className="lg:col-span-2">
          {stages.every((s) => s.count === 0) ? (
            <EmptyState title="No live leads yet" description="Add your first lead to see the funnel fill up." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stages} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="short" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number, name) =>
                      name === "value" ? [formatINR(v), "Pipeline value"] : [v, "Leads"]
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stages.map((s, i) => (
                      <Cell key={s.stage} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {stages.map((s) => (
              <Link key={s.stage} href={`/leads?stage=${s.stage}`}>
                <Badge className={STAGE_META[s.stage].color}>
                  {s.short}: {s.count} · {formatCompactINR(s.value)}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Upcoming follow-ups" subtitle="Next 8 scheduled touchpoints">
          {followUps.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {followUps.map(({ lead, overdue }) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{lead.client?.name}</p>
                      <p className="truncate text-xs text-ink-500">
                        {lead.code} · {STAGE_META[lead.stage].short}
                      </p>
                    </div>
                    <span className={overdue ? "text-xs font-semibold text-rose-600" : "text-xs text-ink-500"}>
                      {formatDate(lead.nextFollowUpAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Lead flow" subtitle="Created vs won, last 6 months">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="created" name="Created" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="won" name="Won" stroke="#1cb567" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Where leads come from" subtitle="Volume and conversion by source">
          {sources.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No data yet.</p>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr>
                    <th className="th">Source</th>
                    <th className="th text-right">Leads</th>
                    <th className="th text-right">Won</th>
                    <th className="th text-right">Conv.</th>
                    <th className="th text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sources.slice(0, 8).map((s) => (
                    <tr key={s.source}>
                      <td className="td font-medium">{s.label}</td>
                      <td className="td text-right">{s.count}</td>
                      <td className="td text-right">{s.won}</td>
                      <td className="td text-right">{s.conversionPct}%</td>
                      <td className="td text-right">{formatCompactINR(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Letters of Intent"
          subtitle="Draft, issue and print an LOI without leaving the CRM."
        >
          {eoiQueue.length === 0 && eoiCandidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">
              Nothing waiting. Leads reach this list once they have a charger configuration.
            </p>
          ) : (
            <>
              {eoiQueue.length > 0 && (
                <>
                  <p className="label">In progress</p>
                  <ul className="divide-y divide-ink-100">
                    {eoiQueue.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink-900">
                              {l.client?.name}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {l.eoi?.number} · {formatCompactINR(l.eoi?.totalAmount ?? l.value)}
                            </span>
                          </span>
                          <Badge className={EOI_STATUS_COLOR[l.eoi!.status]}>
                            {EOI_STATUS_LABEL[l.eoi!.status]}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {eoiCandidates.length > 0 && (
                <>
                  <p className="label mt-4">Ready for a letter</p>
                  <ul className="divide-y divide-ink-100">
                    {eoiCandidates.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {l.client?.name}
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            {l.code} · {STAGE_META[l.stage].short} · {formatCompactINR(l.value)}
                          </span>
                        </span>
                        <Link href={`/leads/${l.id}`}>
                          <Button size="sm">
                            <FileSignature className="h-3.5 w-3.5" /> Draft
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Card>

        <Card title="Charger demand" subtitle="Units requested across all open and closed leads">
          {demand.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No configurations captured yet.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demand} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Units"]} />
                  <Bar dataKey="units" fill="#1cb567" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {role && isAdmin(role) && (
          <Card
            title="Top agents"
            subtitle="Ranked by closed value"
            actions={<Link href="/agents"><Button size="sm">View all</Button></Link>}
          >
            {agents.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No agent activity yet.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Agent</th>
                      <th className="th text-right">Active</th>
                      <th className="th text-right">Won</th>
                      <th className="th text-right">Conv.</th>
                      <th className="th text-right">Closed value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {agents.map((a) => (
                      <tr key={a.ownerId}>
                        <td className="td font-medium">{a.ownerName}</td>
                        <td className="td text-right">{a.active}</td>
                        <td className="td text-right">{a.won}</td>
                        <td className="td text-right">{a.conversionPct}%</td>
                        <td className="td text-right">{formatCompactINR(a.wonValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total leads" value={totals.total} />
        <StatCard label="On hold" value={totals.onHold} />
        <StatCard
          label="Rejected"
          value={totals.rejected}
          tone="negative"
          icon={<XCircle className="h-4 w-4" />}
          sub={<Link href="/leads?status=REJECTED" className="text-brand-700 hover:underline">Review rejected leads</Link>}
        />
        <StatCard label="Overdue follow-ups" value={totals.overdueFollowUps} tone={totals.overdueFollowUps ? "warn" : "default"} />
      </div>
    </>
  );
}
