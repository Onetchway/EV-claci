"use client";

import { useMemo, useState, useEffect } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, PageHeader, Select, Spinner, StatCard, useAsyncAction,
} from "@/components/ui";
import { markRevenueSharePaid, subscribeSiteRevenueShares } from "@/lib/db/settlements";
import { canManageSettlements } from "@/lib/permissions";
import type { SiteRevenueShare } from "@/lib/types";
import { formatDateTime, formatINR } from "@/lib/utils";

export default function SettlementsPage() {
  const viewer = useViewer();
  const canManage = canManageSettlements(viewer);
  const { run, busy } = useAsyncAction();

  const [rows, setRows] = useState<SiteRevenueShare[] | null>(null);
  const [zoneFilter, setZoneFilter] = useState("");

  useEffect(() => subscribeSiteRevenueShares(setRows), []);

  const zones = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows ?? []) map.set(r.zoneId, r.zoneName);
    return [...map.entries()];
  }, [rows]);

  const filtered = useMemo(
    () => (zoneFilter ? (rows ?? []).filter((r) => r.zoneId === zoneFilter) : rows ?? []),
    [rows, zoneFilter],
  );

  const totals = useMemo(() => {
    const pending = filtered.filter((r) => r.status === "PENDING");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((a, r) => a + r.shareAmountInr, 0),
      paidAmount: filtered.filter((r) => r.status === "PAID").reduce((a, r) => a + r.shareAmountInr, 0),
    };
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Settlements"
        description="Per-session revenue share owed to a site host (set on Zones & Load Balancing), accrued automatically as sessions bill. Mark an entry paid once you've actually paid the site out — this doesn't move money itself."
        actions={(
          <Select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            options={zones.map(([id, name]) => ({ value: id, label: name }))}
            placeholder="All sites"
          />
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Pending payout" value={formatINR(totals.pendingAmount)} tone={totals.pendingAmount ? "warn" : "default"} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Pending entries" value={totals.pendingCount} />
        <StatCard label="Paid to date" value={formatINR(totals.paidAmount)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-8 w-8" />}
          title="No revenue share accrued yet"
          description="Nothing here until a session bills at a zone that has a revenue share % set."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Site</th>
                  <th className="th">Charger</th>
                  <th className="th">When</th>
                  <th className="th text-right">Session total</th>
                  <th className="th text-right">Share %</th>
                  <th className="th text-right">Owed</th>
                  <th className="th">Status</th>
                  {canManage && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{r.zoneName}</td>
                    <td className="td text-ink-600">{r.chargePointId}</td>
                    <td className="td text-ink-600">{formatDateTime(r.createdAt)}</td>
                    <td className="td text-right tabular-nums text-ink-600">{formatINR(r.grossAmountInr)}</td>
                    <td className="td text-right tabular-nums text-ink-600">{r.sharePct}%</td>
                    <td className="td text-right tabular-nums font-medium">{formatINR(r.shareAmountInr)}</td>
                    <td className="td">
                      <Badge className={r.status === "PAID" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}>
                        {r.status === "PAID" ? "Paid" : "Pending"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        {r.status === "PENDING" && (
                          <Button size="sm" loading={busy} onClick={() => void run(() => markRevenueSharePaid(r.id), "Marked paid.")}>
                            Mark paid
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
