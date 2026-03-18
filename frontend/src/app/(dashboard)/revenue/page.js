'use client';
import { useEffect, useState } from 'react';
import { revenueApi, stationsApi } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import KPICard from '@/components/dashboard/KPICard';
import Pagination from '@/components/ui/Pagination';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Download, RefreshCw, Battery } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function RevenuePage() {
  const [summary, setSummary]   = useState(null);
  const [records, setRecords]   = useState([]);
  const [pnl, setPnl]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stations, setStations] = useState([]);
  const [filters, setFilters]   = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to:   format(new Date(), 'yyyy-MM-dd'),
    stationId: '', page: 1,
  });
  const [loading, setLoading]   = useState(true);
  const [computing, setComputing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, r, p] = await Promise.all([
        revenueApi.summary(filters),
        revenueApi.list(filters),
        revenueApi.pnl(filters),
      ]);
      setSummary(s); setRecords(r.data || []); setPagination(r.pagination); setPnl(p);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => { stationsApi.list({ limit: 100 }).then(r => setStations(r.data || [])).catch(() => {}); }, []);

  const handleCompute = async () => {
    if (!filters.stationId) return toast.error('Select a station first');
    setComputing(true);
    try { await revenueApi.compute({ stationId: filters.stationId, date: filters.to }); toast.success('Revenue computed!'); load(); }
    catch (e) { toast.error(e.message); }
    finally { setComputing(false); }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between card p-4">
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" className="input" value={filters.from} onChange={e => setFilters(f => ({...f, from: e.target.value, page: 1}))} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input" value={filters.to} onChange={e => setFilters(f => ({...f, to: e.target.value, page: 1}))} />
          <select className="input w-48" value={filters.stationId} onChange={e => setFilters(f => ({...f, stationId: e.target.value, page: 1}))}>
            <option value="">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load}><RefreshCw className="w-4 h-4" /></button>
          <button className="btn-secondary" disabled={computing} onClick={handleCompute}>Compute Revenue</button>
          <a className="btn-primary" href={revenueApi.export(filters)} download>
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Revenue"       value={formatCurrency(summary.totalRevenue)}    icon={TrendingUp} color="green" />
          <KPICard title="Electricity Cost"    value={formatCurrency(summary.electricityCost)} icon={Battery}    color="red" />
          <KPICard title="Gross Margin"        value={formatCurrency(summary.grossMargin)}     icon={TrendingUp} color="blue" />
          <KPICard title="Net Revenue"         value={formatCurrency(summary.netRevenue)}      icon={TrendingUp} color="purple" sub={`Franchise payout: ${formatCurrency(summary.franchisePayout)}`} />
        </div>
      )}

      {/* P&L by Station */}
      {pnl.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">P&L by Station</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pnl} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="station.name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="totalRevenue"   name="Revenue"       fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="electricityCost" name="Elec Cost"    fill="#ef4444" radius={[4,4,0,0]} />
              <Bar dataKey="franchisePayout" name="Franchise"    fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="netRevenue"      name="Net Revenue"  fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Records Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Station</th><th>Charging Rev</th><th>BSS Rev</th><th>Total Rev</th><th>Elec Cost</th><th>Gross Margin</th><th>Franchise</th><th>Net Rev</th><th>Energy (kWh)</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="text-center text-gray-400 py-8">Loading…</td></tr> :
               records.map(r => (
                <tr key={r.id}>
                  <td className="text-xs">{format(new Date(r.date), 'dd MMM yyyy')}</td>
                  <td className="text-xs font-medium">{r.station?.name}</td>
                  <td>{formatCurrency(r.chargingRevenue)}</td>
                  <td>{formatCurrency((r.bssSwapRevenue || 0) + (r.bssRentalRevenue || 0))}</td>
                  <td className="font-semibold">{formatCurrency(r.totalRevenue)}</td>
                  <td className="text-red-600">{formatCurrency(r.electricityCost)}</td>
                  <td className="text-blue-600">{formatCurrency(r.grossMargin)}</td>
                  <td className="text-orange-600">{formatCurrency(r.franchisePayout)}</td>
                  <td className="font-semibold text-green-700">{formatCurrency(r.netRevenue)}</td>
                  <td>{formatNumber(r.energyKwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={p => setFilters(f => ({...f, page: p}))} />
      </div>
    </div>
  );
}
