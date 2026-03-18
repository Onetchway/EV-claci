'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { stationsApi, dashboardApi } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import KPICard from '@/components/dashboard/KPICard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapPin, Zap, TrendingUp, Battery, Activity } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function StationDetailPage() {
  const { id } = useParams();
  const [station, setStation] = useState(null);
  const [dash, setDash]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([stationsApi.get(id), dashboardApi.station(id)])
      .then(([s, d]) => { setStation(s); setDash(d); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading…</div>;
  if (!station) return <div className="text-red-500">Station not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{station.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" />{station.address}, {station.city}, {station.state}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge status={station.stationType} label={station.stationType?.replace('_',' ')} />
            <Badge status={station.isActive ? 'COMPLETED' : 'CANCELLED'} label={station.isActive ? 'Active' : 'Inactive'} />
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Buy: <span className="font-semibold text-gray-900">₹{station.electricityRate}/kWh</span></p>
          <p>Sell: <span className="font-semibold text-green-600">₹{station.sellingRate}/kWh</span></p>
        </div>
      </div>

      {/* KPIs */}
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Revenue"   value={formatCurrency(dash.totalRevenue)}    icon={TrendingUp} color="green" />
          <KPICard title="Net Revenue"     value={formatCurrency(dash.netRevenue)}      icon={TrendingUp} color="blue" />
          <KPICard title="Energy (kWh)"    value={formatNumber(dash.totalEnergyKwh)}    icon={Battery}    color="purple" />
          <KPICard title="Active Sessions" value={dash.activeSessions}                  icon={Activity}   color="orange"
            sub={`${Math.round(dash.utilization)}% utilization`} />
        </div>
      )}

      {/* Revenue Chart */}
      {dash?.dailyRevenue?.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue (₹)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dash.dailyRevenue}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={v => format(new Date(v), 'dd MMM')} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#rg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chargers Grid */}
      {dash?.chargers?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Chargers ({dash.chargers.length})</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
            {dash.chargers.map(c => (
              <div key={c.id} className="border border-gray-200 rounded-xl p-3 text-center">
                <Zap className={`w-6 h-6 mx-auto mb-1 ${c.status === 'CHARGING' ? 'text-blue-500' : c.status === 'FAULT' ? 'text-red-500' : 'text-green-500'}`} />
                <p className="text-xs font-semibold truncate">{c.asset?.name || c.ocppId || c.id.slice(-6)}</p>
                <p className="text-xs text-gray-400">{c.connectorType} · {c.powerRating}kW</p>
                <Badge status={c.status} className="mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Assets ({station.assets?.length || 0})</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>OEM</th><th>Capacity</th><th>Ownership</th><th>Franchise</th><th>Status</th></tr></thead>
            <tbody>
              {station.assets?.map(a => (
                <tr key={a.id}>
                  <td className="font-medium">{a.name}</td>
                  <td><Badge status={a.assetType} label={a.assetType} /></td>
                  <td className="text-gray-500">{a.oem || '—'}</td>
                  <td>{a.capacity ? `${a.capacity} kW` : '—'}</td>
                  <td><Badge status={a.ownership === 'COMPANY' ? 'COMPLETED' : 'ACTIVE'} label={a.ownership} /></td>
                  <td>{a.franchise?.name || '—'}</td>
                  <td><Badge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
