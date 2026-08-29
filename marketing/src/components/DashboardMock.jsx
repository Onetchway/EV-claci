'use client';

import { LayoutGrid, Zap, Activity, Users, BarChart3, Settings, Search, Bell, MapPin, ArrowUpRight } from 'lucide-react';

const NAV = [
  { icon: LayoutGrid, active: true },
  { icon: Zap, active: false },
  { icon: Activity, active: false },
  { icon: Users, active: false },
  { icon: BarChart3, active: false },
  { icon: Settings, active: false },
];

const STATS = [
  { icon: Zap, label: 'Live chargers', value: '1,256', trend: '+12% vs yesterday' },
  { icon: Activity, label: 'Active sessions', value: '842', trend: '+8% vs yesterday' },
  { icon: BarChart3, label: 'Energy today', value: '18.6 MWh', trend: '+15% vs yesterday' },
  { icon: Zap, label: 'Uptime', value: '>95%', trend: 'Commitment met' },
];

const CHART_LABELS = ['2 AM', '6 AM', '10 AM', '2 PM', '6 PM', '10 PM'];
const BARS = [38, 44, 58, 68, 80, 90, 84, 72, 61, 74, 66, 52];

const SESSIONS = [
  { id: 'CH-014', location: 'Lucknow', status: 'Active', seen: '2 mins ago' },
  { id: 'CH-027', location: 'Noida', status: 'Active', seen: '1 min ago' },
  { id: 'CH-032', location: 'Dehradun', status: 'Idle', seen: '5 mins ago' },
];

/** Illustrative CMS/CRM-style dashboard mockup — a demo UI screenshot; all values are example/placeholder data, not real network metrics. */
export default function DashboardMock({ compact = false }) {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#0A1B33]">
      {/* Sidebar */}
      <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-black/20 py-5 sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime text-[10px] font-bold text-ink">LG</span>
        {NAV.map((n, i) => (
          <span
            key={i}
            className={
              'flex h-8 w-8 items-center justify-center rounded-lg ' +
              (n.active ? 'bg-lime/20 text-lime' : 'text-white/35')
            }
          >
            <n.icon className="h-4 w-4" />
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-white/35">
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search network, location or charger…</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative">
              <Bell className="h-4 w-4 text-white/35" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lime" />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[9px] font-bold text-white">LG</span>
          </div>
        </div>

        <div className="p-5">
          {/* Stat row */}
          <div className={'grid grid-cols-2 gap-3' + (compact ? '' : ' lg:grid-cols-4')}>
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.05] p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-lime/15 text-lime">
                  <s.icon className="h-3.5 w-3.5" />
                </span>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-white/40">{s.label}</div>
                <div className="mt-0.5 text-base font-bold text-white">{s.value}</div>
                <div className="mt-1 flex items-center gap-1 text-[9px] text-lime/80">
                  <ArrowUpRight className="h-2.5 w-2.5" /> {s.trend}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          {!compact && (
            <div className="mt-4 rounded-xl bg-white/[0.05] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-white/40">Energy delivered</span>
                <span className="text-[10px] text-white/30">Last 12 hrs</span>
              </div>
              <svg viewBox="0 0 300 110" className="mt-3 h-24 w-full">
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1="0" x2="300" y1={10 + i * 24} y2={10 + i * 24} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
                ))}
                {[10, 34, 58, 82].map((y, i) => (
                  <text key={i} x="0" y={y - 2} style={{ fontSize: 7, fill: 'rgba(255,255,255,.3)' }}>
                    {['2.0', '1.5', '1.0', '0.5'][i]} MWh
                  </text>
                ))}
                {BARS.map((h, i) => (
                  <rect
                    key={i}
                    x={i * 25 + 2}
                    y={94 - h * 0.72}
                    width={16}
                    height={h * 0.72}
                    rx={3}
                    fill={i === BARS.length - 5 ? '#6FDB92' : 'rgba(255,255,255,.15)'}
                  />
                ))}
              </svg>
              <div className="mt-1 flex justify-between text-[9px] text-white/30">
                {CHART_LABELS.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Session table */}
          <div className="mt-4 overflow-hidden rounded-xl bg-white/[0.05]">
            <div className="grid grid-cols-4 gap-2 border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-wide text-white/30">
              <span>Charger</span>
              <span>Location</span>
              <span>Status</span>
              <span>Last Seen</span>
            </div>
            {SESSIONS.map((s) => (
              <div key={s.id} className="grid grid-cols-4 items-center gap-2 border-b border-white/5 px-4 py-2.5 text-xs text-white/75 last:border-0">
                <span className="font-medium">{s.id}</span>
                <span className="flex items-center gap-1 text-white/50">
                  <MapPin className="h-3 w-3" /> {s.location}
                </span>
                <span className={'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (s.status === 'Active' ? 'bg-lime/15 text-lime' : 'bg-white/10 text-white/50')}>
                  <span className={'h-1.5 w-1.5 rounded-full ' + (s.status === 'Active' ? 'bg-lime' : 'bg-white/40')} />
                  {s.status}
                </span>
                <span className="text-[11px] text-white/40">{s.seen}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
