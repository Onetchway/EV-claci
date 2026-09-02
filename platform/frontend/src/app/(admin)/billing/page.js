'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { billingPlansApi } from '@/lib/api';

function PlanForm({ plan, onClose, onSaved }) {
  const [form, setForm] = useState(plan ? {
    name: plan.name, billing_model: plan.billing_model,
    fixed_monthly_amount: plan.fixed_monthly_amount || 0, per_employee_amount: plan.per_employee_amount || 0,
    currency: plan.currency, tax_percent: plan.tax_percent,
  } : {
    name: '', billing_model: 'fixed_monthly',
    fixed_monthly_amount: 0, per_employee_amount: 0,
    currency: 'INR', tax_percent: 18,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (plan) await billingPlansApi.update(plan.id, form);
      else await billingPlansApi.create(form);
      toast.success(plan ? 'Billing plan updated.' : 'Billing plan created.');
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
        <h2 className="text-lg font-semibold">{plan ? 'Edit billing plan' : 'New billing plan'}</h2>
        <div>
          <label className="label">Plan name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Billing model</label>
          <select className="input" value={form.billing_model} onChange={(e) => setForm({ ...form, billing_model: e.target.value })}>
            <option value="fixed_monthly">Fixed monthly</option>
            <option value="per_employee">Per employee / month</option>
          </select>
        </div>
        {form.billing_model === 'fixed_monthly' ? (
          <div>
            <label className="label">Fixed monthly amount</label>
            <input className="input" type="number" step="0.01" value={form.fixed_monthly_amount} onChange={(e) => setForm({ ...form, fixed_monthly_amount: Number(e.target.value) })} />
          </div>
        ) : (
          <div>
            <label className="label">Amount per employee / month</label>
            <input className="input" type="number" step="0.01" value={form.per_employee_amount} onChange={(e) => setForm({ ...form, per_employee_amount: Number(e.target.value) })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Currency</label>
            <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax %</label>
            <input className="input" type="number" step="0.01" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}</button>
        </div>
      </form>
    </div>
  );
}

export default function BillingPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setPlans((await billingPlansApi.list()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (plan) => {
    try {
      await billingPlansApi.update(plan.id, { is_active: !plan.is_active });
      toast.success(plan.is_active ? 'Plan deactivated.' : 'Plan activated.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removePlan = async (plan) => {
    if (!window.confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
    try {
      await billingPlansApi.delete(plan.id);
      toast.success('Plan deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Billing plans</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New plan</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>Rate</th>
              <th>Tax</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Loading…</td></tr>}
            {!loading && plans.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No billing plans yet.</td></tr>}
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="capitalize">{p.billing_model.replace('_', ' ')}</td>
                <td>
                  {p.billing_model === 'per_employee'
                    ? `${p.currency} ${p.per_employee_amount} / employee / mo`
                    : `${p.currency} ${p.fixed_monthly_amount} / mo`}
                </td>
                <td>{p.tax_percent}%</td>
                <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
                <td>
                  <div className="flex items-center gap-3 text-sm">
                    <button className="text-brand-600 hover:underline" onClick={() => setEditing(p)}>Edit</button>
                    <button className="text-ink-500 hover:underline" onClick={() => toggleActive(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button className="text-danger-600 hover:underline" onClick={() => removePlan(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <PlanForm onClose={() => setShowCreate(false)} onSaved={load} />}
      {editing && <PlanForm plan={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
