'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowUpRight, Building2, Clock, IndianRupee, LayoutGrid, Plus, Users,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { dashboardApi } from '@/lib/api';

const money = (n, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

function StatCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${tone === 'warn' ? 'bg-warn-50 text-warn-600' : 'bg-brand-50 text-brand-600'}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function RevenueTrendChart({ data }) {
  const chartData = data.map((r) => ({
    label: new Date(`${r.month}-01`).toLocaleDateString('en-US', { month: 'short' }),
    total: r.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          formatter={(v) => [money(v), 'Billed']}
        />
        <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    dashboardApi.overview().then(setData).catch((err) => toast.error(err.message));
  }, []);

  if (!data) {
    return <div className="animate-pulse text-sm text-ink-400">Loading…</div>;
  }

  const activeTenants = data.tenants_by_status.active || 0;
  const trialTenants = data.tenants_by_status.trial || 0;
  const totalTenants = Object.values(data.tenants_by_status).reduce((a, b) => a + b, 0);
  const overdueCount = data.invoices_by_status.overdue?.count || 0;
  const overdueTotal = data.invoices_by_status.overdue?.total || 0;
  const needsAttention = [
    ...data.overdue_invoices.map((inv) => ({
      key: `inv-${inv.id}`,
      text: `Invoice overdue — ${inv.tenant_name} (${inv.invoice_number}, ${money(inv.total_amount, inv.currency)})`,
      href: '/invoices',
    })),
    ...data.trials_ending_soon.map((t) => ({
      key: `trial-${t.id}`,
      text: `Trial ending soon — ${t.name} (${new Date(t.trial_ends_at).toLocaleDateString()})`,
      href: `/tenants/${t.id}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">Everything running across every tenant, at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tenants?new=1" className="btn-secondary">
            <Plus className="h-4 w-4" /> New organization
          </Link>
          <Link href="/billing?new=1" className="btn-secondary">
            <LayoutGrid className="h-4 w-4" /> New plan
          </Link>
          {overdueCount > 0 && (
            <Link href="/invoices" className="btn-secondary text-danger-600">
              <AlertTriangle className="h-4 w-4" /> {overdueCount} overdue invoice{overdueCount === 1 ? '' : 's'}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizations" value={totalTenants} sub={`${activeTenants} active · ${trialTenants} on trial`} icon={Building2} />
        <StatCard label="Billable seats" value={data.billable_seats.toLocaleString()} sub={`${data.active_users.toLocaleString()} active users`} icon={Users} />
        <StatCard label="MRR" value={money(data.estimated_mrr)} sub={`${money(data.estimated_arr)} ARR`} icon={IndianRupee} />
        <StatCard
          label="Overdue"
          value={overdueCount}
          sub={overdueCount ? money(overdueTotal) : 'Nothing outstanding'}
          icon={AlertTriangle}
          tone={overdueCount ? 'warn' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div>
              <p className="card-title">Billed revenue</p>
              <p className="card-subtitle">Actual invoice totals, last 6 months</p>
            </div>
          </div>
          <div className="card-pad">
            {data.revenue_trend.every((r) => r.total === 0) ? (
              <div className="empty-state">
                <p className="empty-state-title">No invoices billed yet</p>
                <p className="empty-state-text">Once tenants are on active, billed plans, their monthly totals show up here.</p>
              </div>
            ) : (
              <RevenueTrendChart data={data.revenue_trend} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <p className="card-title">Needs attention</p>
              <p className="card-subtitle">{needsAttention.length} item{needsAttention.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="card-pad">
            {needsAttention.length === 0 ? (
              <div className="empty-state py-8">
                <p className="empty-state-title">All clear</p>
                <p className="empty-state-text">No overdue invoices or trials ending in the next 7 days.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {needsAttention.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="flex items-start gap-2 text-sm text-ink-700 hover:text-brand-700 group">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-500" />
                      <span className="flex-1">{item.text}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover:text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Recent activity</p>
            <p className="card-subtitle">Latest platform actions across every tenant</p>
          </div>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="empty-state">
            <Clock className="h-5 w-5 text-ink-300" />
            <p className="empty-state-title">No activity yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.recent_activity.map((a, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-ink-800">{a.action}</span>
                  {a.tenant_name && <span className="text-ink-400"> · {a.tenant_name}</span>}
                </div>
                <span className="text-xs text-ink-400">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
