'use client';
import { useEffect, useState, useCallback } from 'react';
import { nakjmTeamApi } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Users2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['project_management', 'site', 'procurement', 'design', 'finance', 'qc_qa', 'admin'];
const EMPTY = { name: '', email: '', phone: '', designation: '', department: 'site', joined_date: '' };

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nakjmTeamApi.list({ page, limit: 15 });
      setMembers(res.data || []); setPagination(res.pagination);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await nakjmTeamApi.create(form);
      toast.success('Team member added!'); setShowForm(false); setForm(EMPTY); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Team Member</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Team Member</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Full Name*</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <div>
                <label className="label">Department</label>
                <select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Joined Date</label><input className="input" type="date" value={form.joined_date} onChange={e => setForm(f => ({ ...f, joined_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Add Member</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Email</th><th>Phone</th><th>Active Projects</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-6">Loading…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-6">No team members yet.</td></tr>
            ) : members.map(m => (
              <tr key={m.id}>
                <td className="font-medium flex items-center gap-2"><Users2 className="w-4 h-4 text-gray-400" /> {m.name}</td>
                <td>{m.designation || '—'}</td>
                <td className="capitalize">{m.department.replace(/_/g, ' ')}</td>
                <td>{m.email || '—'}</td>
                <td>{m.phone || '—'}</td>
                <td>{m.active_project_count}</td>
                <td><Badge status={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}
