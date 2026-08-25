'use client';
import { useEffect, useState } from 'react';
import { nakjmDashboardApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import KPICard from '@/components/dashboard/KPICard';
import { Building2, Briefcase, Truck, Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NakjmDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nakjmDashboardApi.overview()
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Active Clients" value={data.active_clients} icon={Building2} color="blue" />
        <KPICard title="Active Vendors" value={data.active_vendors} icon={Truck} color="orange" />
        <KPICard title="Contract Value" value={formatCurrency(data.total_contract_value)} icon={Briefcase} color="purple" />
        <KPICard title="Estimated Margin" value={formatCurrency(data.estimated_margin)} icon={TrendingUp} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-brand-600" /> Client Collections</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-gray-500">Invoiced</p><p className="text-sm font-bold">{formatCurrency(data.client_invoiced)}</p></div>
            <div><p className="text-xs text-gray-500">Collected</p><p className="text-sm font-bold text-green-600">{formatCurrency(data.client_collected)}</p></div>
            <div><p className="text-xs text-gray-500">Pending</p><p className="text-sm font-bold text-amber-600">{formatCurrency(data.client_collection_pending)}</p></div>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600" style={{ width: `${Math.min(data.client_collection_percent, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-500">{data.client_collection_percent}% of contract value collected</p>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Truck className="w-4 h-4 text-brand-600" /> Vendor Payouts</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-gray-500">Committed</p><p className="text-sm font-bold">{formatCurrency(data.vendor_committed)}</p></div>
            <div><p className="text-xs text-gray-500">Paid</p><p className="text-sm font-bold text-green-600">{formatCurrency(data.vendor_paid)}</p></div>
            <div><p className="text-xs text-gray-500">Outstanding</p><p className="text-sm font-bold text-red-600">{formatCurrency(data.vendor_outstanding)}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Projects by Status</h3>
          <div className="space-y-2">
            {data.projects_by_status.map(s => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-gray-600">{s.status.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
            {data.projects_by_status.length === 0 && <p className="text-sm text-gray-400">No projects yet.</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> Upcoming Deadlines</h3>
          <div className="space-y-2">
            {data.upcoming_deadlines.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.name}</span>
                <span className="text-gray-500">{formatDate(p.target_end_date)}</span>
              </div>
            ))}
            {data.upcoming_deadlines.length === 0 && <p className="text-sm text-gray-400">Nothing due soon.</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Recent Site Reports</h3>
        <div className="space-y-2">
          {data.recent_site_reports.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
              <span className="text-gray-700">{r.project_name}</span>
              <span className="text-gray-500 capitalize">{r.report_type}</span>
              <span className="font-medium">{r.progress_percent}%</span>
              <span className="text-gray-400">{formatDate(r.report_date)}</span>
            </div>
          ))}
          {data.recent_site_reports.length === 0 && <p className="text-sm text-gray-400">No site reports yet.</p>}
        </div>
      </div>
    </div>
  );
}
