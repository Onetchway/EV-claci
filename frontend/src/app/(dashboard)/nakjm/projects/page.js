'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { nakjmProjectsApi, nakjmClientsApi, nakjmDocumentsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['lead', 'quotation', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const TYPES = ['ev_charging_station', 'ht_connection', 'solar', 'substation', 'battery_swap', 'other'];
const EMPTY = { project_code: '', name: '', client_id: '', project_type: 'ev_charging_station', city: '', state: '', capacity_kw: '', status: 'lead', budget_amount: 0, contract_value: 0, start_date: '', target_end_date: '' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [poFile, setPoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nakjmProjectsApi.list({ page, limit: 12, status: status || undefined });
      setProjects(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { nakjmClientsApi.list({ limit: 200 }).then(r => setClients(r.data || [])).catch(() => {}); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let source_document_id = null;
      if (poFile) {
        const doc = await nakjmDocumentsApi.upload({ file: poFile, doc_type: 'client_po' });
        source_document_id = doc.id;
      }
      await nakjmProjectsApi.create({
        ...form,
        capacity_kw: form.capacity_kw ? parseFloat(form.capacity_kw) : null,
        budget_amount: parseFloat(form.budget_amount) || 0,
        contract_value: parseFloat(form.contract_value) || 0,
        source_document_id,
      });
      toast.success('Project created!'); setShowForm(false); setForm(EMPTY); setPoFile(null); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <select className="input max-w-xs" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Project</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Project</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Project Code*</label><input className="input" required value={form.project_code} onChange={e => setForm(f => ({ ...f, project_code: e.target.value }))} /></div>
              <div><label className="label">Project Name*</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <label className="label">Client*</label>
                <select className="input" required value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Project Type</label>
                <select className="input" value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">City</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><label className="label">State</label><input className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
              <div><label className="label">Capacity (kW)</label><input className="input" type="number" value={form.capacity_kw} onChange={e => setForm(f => ({ ...f, capacity_kw: e.target.value }))} /></div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Budget (₹)</label><input className="input" type="number" value={form.budget_amount} onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value }))} /></div>
              <div><label className="label">Contract Value (₹)</label><input className="input" type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} /></div>
              <div><label className="label">Start Date</label><input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><label className="label">Target End Date</label><input className="input" type="date" value={form.target_end_date} onChange={e => setForm(f => ({ ...f, target_end_date: e.target.value }))} /></div>
              <div className="col-span-2">
                <label className="label">Client PO / Work Order (optional — create this project straight from it)</label>
                <input className="input" type="file" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={e => setPoFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Project'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Code</th><th>Project</th><th>Client</th><th>Status</th><th>Contract Value</th><th>Collected</th><th>Target End</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-6">Loading…</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-6">No projects yet.</td></tr>
            ) : projects.map(p => (
              <tr key={p.id}>
                <td><Link href={`/nakjm/projects/${p.id}`} className="text-brand-600 font-medium">{p.project_code}</Link></td>
                <td>{p.name}</td>
                <td>{p.client_name}</td>
                <td><Badge status={p.status} /></td>
                <td>{formatCurrency(p.contract_value)}</td>
                <td className="text-green-600 font-medium">{formatCurrency(p.collected_amount)}</td>
                <td>{formatDate(p.target_end_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}
