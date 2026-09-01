"use client";

/** A small donut chart with a centered total and a legend — used for stat breakdowns (power type, access type, etc.) across the CMS dashboards. */

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ slices, size = 132 }: { slices: DonutSlice[]; size?: number }) {
  const total = useMemo(() => slices.reduce((a, s) => a + s.value, 0), [slices]);
  const nonZero = slices.filter((s) => s.value > 0);

  if (total === 0) {
    return (
      <div className="flex items-center gap-4">
        <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs text-ink-400">
          No data
        </div>
        <ul className="space-y-1 text-sm">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-ink-600">{s.label}</span>
              <span className="ml-auto tabular-nums text-ink-400">0</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={nonZero}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={nonZero.length > 1 ? 2 : 0}
              stroke="#fff"
              strokeWidth={2}
            >
              {nonZero.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-ink-900">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-400">Total</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-1 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-ink-600">{s.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-ink-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
