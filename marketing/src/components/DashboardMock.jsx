'use client';

import { LayoutGrid, Zap, Activity, Users, BarChart3, Settings, Search, Bell, MapPin } from 'lucide-react';

const NAV = [
  { icon: LayoutGrid, active: true },
  { icon: Zap, active: false },
  { icon: Activity, active: false },
  { icon: Users, active: false },
  { icon: BarChart3, active: false },
  { icon: Settings, active: false },
];

const STATS = [
  { icon: Zap, label: 'Network status', value: 'All systems live' },
  { icon: Activity, label: 'Diagnostics', value: 'Nominal' },
  { icon: BarChart3, label: 'Load balancing', value: 'Optimised' },
];

const BARS = [38, 52, 44, 68, 58, 74, 61, 80, 66, 90, 72, 84];

const SESSIONS = [
  { id: 'CH-014', location: 'Lucknow', status: 'Active' },
  { id: 'CH-027', location: 'Noida', status: 'Active' },
  { id: 'CH-032', location: 'Dehradun', status: 'Idle' },
];

/** Illustrative CMS/CRM-style dashboard mockup — all values are placeholder UI chrome, not real network metrics. */
export default function DashboardMock({ compact = false }) {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#0A1B33]">
      {/* Sidebar */}
      <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-black/20 py-5 sm:flex">
        <div className="h-6 w-6 rounded-md bg-lime" />
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
            <span className="text-xs">Search network…</span>
          </div>
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-white/35" />
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-700" />
          </div>
        </div>

        <div className="p-5">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.05] p-3">
                <s.icon className="h-3.5 w-3.5 text-lime" />
                <div className="mt-2 text-[10px] uppercase tracking-wide text-white/40">{s.label}</div>
                <div className="mt-0.5 text-xs font-semibold text-white">{s.value}</div>
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
              <svg viewBox="0 0 240 64" className="mt-3 h-16 w-full">
                {BARS.map((h, i) => (
                  <rect
                    key={i}
                    x={i * 20 + 2}
                    y={64 - h * 0.7}
                    width={12}
                    height={h * 0.7}
                    rx={2}
                    fill={i === BARS.length - 2 ? '#6FDB92' : 'rgba(255,255,255,.15)'}
                  />
                ))}
              </svg>
            </div>
          )}

          {/* Session table */}
          <div className="mt-4 overflow-hidden rounded-xl bg-white/[0.05]">
            <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-wide text-white/30">
              <span>Charger</span>
              <span>Location</span>
              <span>Status</span>
            </div>
            {SESSIONS.map((s) => (
              <div key={s.id} className="grid grid-cols-3 items-center gap-2 border-b border-white/5 px-4 py-2.5 text-xs text-white/75 last:border-0">
                <span className="font-medium">{s.id}</span>
                <span className="flex items-center gap-1 text-white/50">
                  <MapPin className="h-3 w-3" /> {s.location}
                </span>
                <span className={'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (s.status === 'Active' ? 'bg-lime/15 text-lime' : 'bg-white/10 text-white/50')}>
                  <span className={'h-1.5 w-1.5 rounded-full ' + (s.status === 'Active' ? 'bg-lime' : 'bg-white/40')} />
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
