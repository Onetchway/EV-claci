'use client';
import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import KPICard from '@/components/dashboard/KPICard';
import Badge from '@/components/ui/Badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { MapPin, Zap, TrendingUp, Battery, Users2, Activity } from 'lucide-react';
import { format } from 'date-fns';

const PIE_COLORS = { AVAILABLE: '#22c55e', CHARGING: '#3b82f6', FAULT: '#ef4444', OFFLINE: '#9ca3af', RESERVED: '#f59e0b' };

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.admin().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard…</div>;
  if (!data)   return <div className="text-red-500">Failed to load dashboard data.</div>;

  const { kpis, chargerStatuses, recentSessions, monthlyRevenue } = data;

  const pieData = Object.entries(chargerStatuses || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Stations"     value={kpis.totalStations}    icon={MapPin}     color="blue"   sub={`${kpis.activeStations} active`} />
        <KPICard title="Total Chargers"     value={kpis.totalChargers}    icon={Zap}        color="green"  sub={`${kpis.availableChargers} available · ${kpis.chargingChargers} charging`} />
        <KPICard title="Active Sessions"    value={kpis.activeSessions}   icon={Activity}   color="orange" sub={`${kpis.totalSessions} total`} />
        <KPICard title="Total Users"        value={kpis.totalUsers}       icon={Users2}     color="purple" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Revenue"      value={formatCurrency(kpis.totalRevenue)}    icon={TrendingUp} color="green"  />
        <KPICard title="Franchise Payout"   value={formatCurrency(kpis.franchisePayout)} icon={TrendingUp} color="orange" />
        <KPICard title="Net Revenue"        value={formatCurrency(kpis.netRevenue)}      icon={TrendingUp} color="blue"   />
        <KPICard title="Total Energy"       value={`${formatNumber(kpis.totalEnergyKwh)} kWh`} icon={Battery} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (₹)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={v => format(new Date(v), 'dd')} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatCurrency(v)} labelFormatter={v => format(new Date(v), 'dd MMM')} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Charger Status Pie */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Charger Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map(({ name }) => <Cell key={name} fill={PIE_COLORS[name] || '#6b7280'} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Energy Bar Chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Energy Delivered (kWh)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" tickFormatter={v => format(new Date(v), 'dd')} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => `${formatNumber(v)} kWh`} labelFormatter={v => format(new Date(v), 'dd MMM')} />
            <Bar dataKey="energy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recent Completed Sessions</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Station</th><th>Connector</th><th>Started</th><th>Energy (kWh)</th><th>Revenue</th><th>Status</th>
            </tr></thead>
            <tbody>
              {recentSessions?.map(s => (
                <tr key={s.id}>
                  <td>{s.station?.name || '—'}</td>
                  <td>{s.charger?.connectorType || '—'}</td>
                  <td className="text-gray-500 text-xs">{format(new Date(s.startTime), 'dd MMM HH:mm')}</td>
                  <td>{formatNumber(s.energyKwh)}</td>
                  <td className="font-medium">{formatCurrency(s.revenue)}</td>
                  <td><Badge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
