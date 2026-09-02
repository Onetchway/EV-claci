'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Wallet } from 'lucide-react';

import { addOnsApi } from '@/lib/api';

function AddOnForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', amount: 0, currency: 'INR' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addOnsApi.createCatalog(form);
      toast.success('Add-on created.');
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
        <h2 className="text-lg font-semibold">New add-on</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount / month</label>
            <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Currency</label>
            <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create add-on'}</button>
        </div>
      </form>
    </div>
  );
}

export default function AddOnsPage() {
  const [addOns, setAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setAddOns((await addOnsApi.catalog()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (a, is_active) => {
    setAddOns((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active } : x)));
    try { await addOnsApi.updateCatalog(a.id, { is_active }); }
    catch (err) { toast.error(err.message); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Add-ons</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Purchasable extras a tenant can be attached to on top of their base plan. Attach one from the tenant's own page.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New add-on</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {!loading && addOns.length === 0 && (
              <tr><td colSpan={4}><div className="empty-state"><Wallet className="h-5 w-5 text-ink-300" /><p className="empty-state-title">No add-ons yet</p></div></td></tr>
            )}
            {addOns.map((a) => (
              <tr key={a.id}>
                <td className="font-medium text-ink-900">{a.name}</td>
                <td className="text-ink-500 max-w-md">{a.description}</td>
                <td>{a.currency} {a.amount}</td>
                <td>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={a.is_active}
                      onChange={(e) => toggleActive(a, e.target.checked)}
                    />
                    <span className="text-sm text-ink-600">{a.is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <AddOnForm onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}
