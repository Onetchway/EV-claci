'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { dashboardApi } from '@/lib/api';

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold text-gray-400 uppercase">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    dashboardApi.overview().then(setData).catch((err) => toast.error(err.message));
  }, []);

  if (!data) return <div className="text-gray-400">Loading…</div>;

  const activeTenants = data.tenants_by_status.active || 0;
  const trialTenants = data.tenants_by_status.trial || 0;
  const suspendedTenants = data.tenants_by_status.suspended || 0;
  const overdueCount = data.invoices_by_status.overdue?.count || 0;
  const overdueTotal = data.invoices_by_status.overdue?.total || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Estimated MRR" value={`₹${data.estimated_mrr.toLocaleString()}`} sub="Active tenants only" />
        <StatCard label="Active tenants" value={activeTenants} sub={`${trialTenants} on trial`} />
        <StatCard label="Suspended tenants" value={suspendedTenants} />
        <StatCard label="Overdue invoices" value={overdueCount} sub={overdueCount ? `₹${overdueTotal.toLocaleString()} outstanding` : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Overdue invoices</h2>
          {data.overdue_invoices.length === 0 && <p className="text-sm text-gray-400">Nothing overdue.</p>}
          <ul className="divide-y divide-gray-100">
            {data.overdue_invoices.map((inv) => (
              <li key={inv.id} className="py-2 flex justify-between text-sm">
                <span>{inv.tenant_name} · {inv.invoice_number}</span>
                <span className="text-red-600">{inv.currency} {inv.total_amount}</span>
              </li>
            ))}
          </ul>
          <Link href="/invoices" className="text-brand-600 hover:underline text-sm block mt-3">View all invoices →</Link>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          {data.recent_activity.length === 0 && <p className="text-sm text-gray-400">No activity yet.</p>}
          <ul className="divide-y divide-gray-100">
            {data.recent_activity.map((a, i) => (
              <li key={i} className="py-2 text-sm">
                <span className="font-medium">{a.action}</span>
                {a.tenant_name && <span className="text-gray-500"> · {a.tenant_name}</span>}
                <div className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
