'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { nakjmClientsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Building2, Plus, X, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const CLIENT_TYPES = ['oem', 'cpo', 'private', 'government', 'other'];
const EMPTY = { name: '', client_type: 'private', contact_name: '', contact_email: '', contact_phone: '', city: '', state: '', gstin: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nakjmClientsApi.list({ page, limit: 12 });
      setClients(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmClientsApi.create(form);
      toast.success('Client added!'); setShowForm(false); setForm(EMPTY); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Client</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Client</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Client / Company Name*</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label className="label">Client Type</label>
                <select className="input" value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}>
                  {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div><label className="label">GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
              {[['contact_name', 'Contact Name'], ['contact_email', 'Contact Email'], ['contact_phone', 'Phone']].map(([k, l]) => (
                <div key={k}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div><label className="label">City</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><label className="label">State</label><input className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Client</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => (
            <Link key={c.id} href={`/nakjm/clients/${c.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-50"><Building2 className="w-5 h-5 text-brand-600" /></div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400 uppercase">{c.client_type}</p>
                  </div>
                </div>
                <Badge status={c.status} />
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1 text-gray-500"><Briefcase className="w-3.5 h-3.5" /> {c.project_count} project(s)</span>
                <span className="font-semibold text-green-600">{formatCurrency(c.total_collected)}</span>
              </div>
            </Link>
          ))}
          {clients.length === 0 && <p className="text-sm text-gray-400 col-span-full">No clients yet.</p>}
        </div>
      )}
      {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
    </div>
  );
}
