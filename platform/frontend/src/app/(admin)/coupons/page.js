'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Tag } from 'lucide-react';

import { couponsApi } from '@/lib/api';

function CouponForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ code: '', discount_type: 'percent', amount: 10, duration_invoices: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await couponsApi.create({ ...form, duration_invoices: form.duration_invoices ? Number(form.duration_invoices) : null });
      toast.success('Coupon created.');
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
        <h2 className="text-lg font-semibold">New coupon</h2>
        <div>
          <label className="label">Code</label>
          <input className="input uppercase" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Discount type</label>
            <select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </div>
          <div>
            <label className="label">{form.discount_type === 'percent' ? 'Percent (%)' : 'Amount'}</label>
            <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">Applies for how many invoices (blank = forever)</label>
          <input className="input" type="number" min="1" value={form.duration_invoices} onChange={(e) => setForm({ ...form, duration_invoices: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create coupon'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCoupons((await couponsApi.list()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (c, is_active) => {
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active } : x)));
    try { await couponsApi.update(c.id, { is_active }); }
    catch (err) { toast.error(err.message); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Coupons</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Discount codes assignable to a tenant's future invoices. Assign one from the tenant's own page.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New coupon</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {!loading && coupons.length === 0 && (
              <tr><td colSpan={4}><div className="empty-state"><Tag className="h-5 w-5 text-ink-300" /><p className="empty-state-title">No coupons yet</p></div></td></tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="font-mono font-medium text-ink-900">{c.code}</td>
                <td>{c.discount_type === 'percent' ? `${c.amount}% off` : `${c.amount} off`}</td>
                <td>{c.duration_invoices ? `${c.duration_invoices} invoice(s)` : 'Until unassigned'}</td>
                <td>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={c.is_active}
                      onChange={(e) => toggleActive(c, e.target.checked)}
                    />
                    <span className="text-sm text-ink-600">{c.is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CouponForm onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}
