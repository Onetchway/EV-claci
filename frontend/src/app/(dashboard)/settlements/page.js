'use client';
import { useEffect, useState, useCallback } from 'react';
import { settlementsApi, franchisesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Plus, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState([]);
  const [pagination, setPagination]   = useState(null);
  const [franchises, setFranchises]   = useState([]);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [form, setForm] = useState({ franchiseId: '', periodStart: '', periodEnd: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await settlementsApi.list({ page, limit: 15 }); setSettlements(res.data || []); setPagination(res.pagination); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { franchisesApi.list({ limit: 100 }).then(r => setFranchises(r.data || [])).catch(() => {}); }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    try { await settlementsApi.generate(form); toast.success('Settlement generated!'); setShowForm(false); load(); }
    catch (e) { toast.error(e.message); }
  };

  const STATUS_TRANSITIONS = { PENDING: 'PROCESSED', PROCESSED: 'PAID', PAID: null, DISPUTED: 'PROCESSED' };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Generate Settlement</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleGenerate} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Generate Settlement</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="label">Franchise</label>
              <select className="input" required value={form.franchiseId} onChange={e => setForm(f => ({...f,franchiseId:e.target.value}))}>
                <option value="">Select franchise</option>
                {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Period Start</label><input type="date" className="input" required value={form.periodStart} onChange={e => setForm(f => ({...f,periodStart:e.target.value}))} /></div>
              <div><label className="label">Period End</label><input type="date" className="input" required value={form.periodEnd} onChange={e => setForm(f => ({...f,periodEnd:e.target.value}))} /></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Generate</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Franchise</th><th>Period</th><th>Total Rev</th><th>Franchise Share</th><th>Company Share</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center text-gray-400 py-8">Loading…</td></tr> :
               settlements.map(s => {
                const next = STATUS_TRANSITIONS[s.status];
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{s.franchise?.name}</td>
                    <td className="text-xs text-gray-500">{format(new Date(s.periodStart),'dd MMM')} – {format(new Date(s.periodEnd),'dd MMM yyyy')}</td>
                    <td className="font-semibold">{formatCurrency(s.totalRevenue)}</td>
                    <td className="text-orange-600">{formatCurrency(s.franchiseShare)}</td>
                    <td className="text-green-700">{formatCurrency(s.companyShare)}</td>
                    <td><Badge status={s.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        {next && (
                          <button className="btn-secondary text-xs py-1 px-2"
                            onClick={async () => { try { await settlementsApi.updateStatus(s.id, { status: next }); toast.success(`Marked as ${next}`); load(); } catch(e){toast.error(e.message);} }}>
                            Mark {next}
                          </button>
                        )}
                        <a className="btn-secondary text-xs py-1 px-2" href={`${process.env.NEXT_PUBLIC_API_URL}/settlements/${s.id}/export`} download>
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
