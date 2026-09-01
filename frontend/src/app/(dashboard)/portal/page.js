'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { franchisesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import { Building2, TrendingUp, Wallet, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

// The franchise partner's own self-service view — GET /api/franchises/portal/dashboard
// resolves to the caller's own franchise_id server-side (see
// backend/src/controllers/franchise.controller.js's portalDashboard), so
// there's no id to pick here, unlike the admin-facing /franchise page.
export default function FranchisePortalPage() {
  const { data: session } = useSession();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await franchisesApi.portalDashboard()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (!data) return <p className="text-gray-400 text-sm">No franchise linked to this account.</p>;

  const { franchise, assets, total_investment, total_earnings, projected_earnings, roi_percent, pending_settlements, recent_settlements } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-50"><Building2 className="w-5 h-5 text-orange-500" /></div>
        <div>
          <h1 className="text-lg font-semibold">{franchise.name}</h1>
          <p className="text-xs text-gray-500">Welcome back, {session?.user?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-gray-500">Invested</p><p className="text-lg font-bold text-gray-900">{formatCurrency(total_investment)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Earned to date</p><p className="text-lg font-bold text-green-600">{formatCurrency(total_earnings)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Projected (current)</p><p className="text-lg font-bold text-blue-600">{formatCurrency(projected_earnings)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">ROI</p><p className="text-lg font-bold text-orange-600">{roi_percent}%</p></div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Zap className="w-4 h-4" /> My Assets ({assets?.length || 0})</p>
        <div className="space-y-2">
          {assets?.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div><p className="font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.station_name} · {a.city}</p></div>
              <Badge status={a.status} />
            </div>
          ))}
          {!assets?.length && <p className="text-xs text-gray-400">No assets yet.</p>}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Wallet className="w-4 h-4" /> Settlements</p>
        {pending_settlements?.length > 0 && (
          <p className="text-xs text-amber-600 mb-2">{pending_settlements.length} pending settlement(s).</p>
        )}
        <div className="space-y-2">
          {recent_settlements?.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div><p className="font-medium">{formatCurrency(s.franchise_share)}</p><p className="text-xs text-gray-400">{formatDate(s.created_at)}</p></div>
              <Badge status={s.status} />
            </div>
          ))}
          {!recent_settlements?.length && <p className="text-xs text-gray-400">No settlements yet.</p>}
        </div>
      </div>
    </div>
  );
}
