'use client';
import { useEffect, useState, useCallback } from 'react';
import { franchisesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Building2, Plus, X, TrendingUp, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPES = ['LAND_OWNER', 'INVESTOR', 'LAND_AND_INVESTOR'];

export default function FranchisePage() {
  const [franchises, setFranchises] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [detail, setDetail]         = useState(null);
  const [form, setForm] = useState({ name: '', contactName: '', contactEmail: '', contactPhone: '', franchiseType: 'INVESTOR', revenueSharePercent: 20, investmentAmount: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await franchisesApi.list({ page, limit: 10 });
      setFranchises(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await franchisesApi.create({...form, revenueSharePercent: parseFloat(form.revenueSharePercent), investmentAmount: parseFloat(form.investmentAmount)});
      toast.success('Franchise created!'); setShowForm(false); load();
    } catch (e) { toast.error(e.message); }
  };

  const openDetail = async (id) => {
    try { const d = await franchisesApi.dashboard(id); setDetail(d); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Franchise</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Franchise Partner</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['name','Company Name*'],['contactName','Contact Name*'],['contactEmail','Contact Email*'],['contactPhone','Phone']].map(([k,l]) => (
                <div key={k}><label className="label">{l}</label><input className="input" required={l.includes('*')} value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} /></div>
              ))}
              <div>
                <label className="label">Franchise Type</label>
                <select className="input" value={form.franchiseType} onChange={e => setForm(f => ({...f, franchiseType: e.target.value}))}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Revenue Share (%)</label>
                <input className="input" type="number" step="0.1" min="0" max="100" value={form.revenueSharePercent} onChange={e => setForm(f => ({...f, revenueSharePercent: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="label">Investment Amount (₹)</label>
                <input className="input" type="number" value={form.investmentAmount} onChange={e => setForm(f => ({...f, investmentAmount: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Partner</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{detail.franchise.name}</h2>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center"><p className="text-xs text-gray-500">Total Revenue</p><p className="text-lg font-bold text-gray-900">{formatCurrency(detail.totalRevenue)}</p></div>
              <div className="card p-4 text-center"><p className="text-xs text-gray-500">Franchise Earnings</p><p className="text-lg font-bold text-green-600">{formatCurrency(detail.franchiseEarnings)}</p></div>
              <div className="card p-4 text-center"><p className="text-xs text-gray-500">ROI</p><p className="text-lg font-bold text-blue-600">{detail.roi}%</p></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Assets ({detail.assets?.length || 0})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detail.assets?.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <div><p className="font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.station?.name} · {a.assetType}</p></div>
                    <Badge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Franchise Cards */}
      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {franchises.map(f => (
            <div key={f.id} className="card p-5 hover:shadow-md cursor-pointer transition-shadow" onClick={() => openDetail(f.id)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50"><Building2 className="w-5 h-5 text-orange-500" /></div>
                  <div>
                    <h3 className="font-semibold text-sm">{f.name}</h3>
                    <p className="text-xs text-gray-500">{f.contactEmail}</p>
                  </div>
                </div>
                <Badge status="FRANCHISE" label={f.franchiseType?.replace('_',' ')} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs font-bold text-orange-600">{f.revenueSharePercent}%</p>
                  <p className="text-xs text-gray-400">Rev Share</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <Zap className="w-3 h-3 mx-auto text-blue-400 mb-0.5" />
                  <p className="text-xs font-bold">{f._count?.assets || 0}</p>
                  <p className="text-xs text-gray-400">Assets</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <TrendingUp className="w-3 h-3 mx-auto text-green-400 mb-0.5" />
                  <p className="text-xs font-bold">{formatCurrency(f.investmentAmount)}</p>
                  <p className="text-xs text-gray-400">Invested</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
