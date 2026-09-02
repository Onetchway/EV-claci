'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

import { adminsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ROLES = ['super_admin', 'billing_ops', 'operations', 'support', 'read_only'];
const ROLE_LABELS = {
  super_admin: 'Owner',
  billing_ops: 'Finance',
  operations: 'Operations',
  support: 'Support',
  read_only: 'Read-only',
};

function AdminForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'support' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminsApi.create(form);
      toast.success('Administrator invited.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">New administrator</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Temporary password</label>
          <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create administrator'}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminsPage() {
  const { admin: me } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setAdmins((await adminsApi.list()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (a, role) => {
    setAdmins((prev) => prev.map((x) => (x.id === a.id ? { ...x, role } : x)));
    try { await adminsApi.update(a.id, { role }); }
    catch (err) { toast.error(err.message); load(); }
  };

  const toggleActive = async (a, is_active) => {
    setAdmins((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active } : x)));
    try { await adminsApi.update(a.id, { is_active }); }
    catch (err) { toast.error(err.message); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Administrators</h1>
          <p className="text-sm text-ink-500 mt-0.5">Who can sign into this super-admin console, and what they can do here.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New administrator</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={4}><div className="empty-state"><ShieldCheck className="h-5 w-5 text-ink-300" /><p className="empty-state-title">No administrators yet</p></div></td></tr>
            )}
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-medium text-ink-900">{a.name}{a.id === me?.id && <span className="text-ink-400 font-normal"> (you)</span>}</td>
                <td className="text-ink-500">{a.email}</td>
                <td>
                  <select className="select w-40" value={a.role} onChange={(e) => changeRole(a, e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={a.is_active}
                      onChange={(e) => toggleActive(a, e.target.checked)}
                    />
                    <span className="text-sm text-ink-600">{a.is_active ? 'Active' : 'Disabled'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <AdminForm onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}
