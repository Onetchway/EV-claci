'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { tenantsApi, billingPlansApi } from '@/lib/api';

const STATUS_BADGE = {
  active: 'badge-green',
  trial: 'badge-yellow',
  suspended: 'badge-red',
  cancelled: 'badge-gray',
};

function CreateTenantModal({ plans, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', contact_name: '', contact_email: '', contact_phone: '',
    deployment_mode: 'shared', billing_plan_id: '', billing_day: 1,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await tenantsApi.create({ ...form, billing_plan_id: form.billing_plan_id || null });
      toast.success(`Tenant "${created.name}" created. API key: ${created.api_key}`, { duration: 10000 });
      // Only meaningful when CRM_PROVISION_URL/SECRET are configured — see
      // platform/backend's tenants.service.js. A CRM login exists the
      // moment the tenant does, not as a separate manual step.
      if (created.crmProvisioning?.ok) {
        toast.success(
          `CRM login for ${created.name}: ${created.crmProvisioning.loginEmail} / ${created.crmProvisioning.temporaryPassword}`,
          { duration: 15000 },
        );
      } else if (created.crmProvisioning?.configured) {
        toast.error(`CRM provisioning failed for ${created.name} — check the platform backend logs. The tenant record was still created.`, { duration: 8000 });
      }
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold">New client / tenant</h2>

        <div>
          <label className="label">Company name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact name</label>
            <input className="input" required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Contact email</label>
            <input className="input" type="email" required value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact phone</label>
            <input className="input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Billing day of month</label>
            <input className="input" type="number" min="1" max="28" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">Hosting / deployment mode</label>
          <select className="input" value={form.deployment_mode} onChange={(e) => setForm({ ...form, deployment_mode: e.target.value })}>
            <option value="dedicated">Dedicated — client's own domain + hosting, fully separate</option>
            <option value="isolated">Isolated — shared hosting, separate database</option>
            <option value="shared">Shared — shared hosting + shared database</option>
          </select>
        </div>
        <div>
          <label className="label">Billing plan</label>
          <select className="input" value={form.billing_plan_id} onChange={(e) => setForm({ ...form, billing_plan_id: e.target.value })}>
            <option value="">— assign later —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.billing_model === 'per_employee' ? `${p.currency} ${p.per_employee_amount}/employee` : `${p.currency} ${p.fixed_monthly_amount}/mo`})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create tenant'}</button>
        </div>
      </form>
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tenantsRes, plansRes] = await Promise.all([tenantsApi.list(), billingPlansApi.list()]);
      setTenants(tenantsRes.data);
      setPlans(plansRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New tenant</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Deployment</th>
              <th>Billing plan</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Loading…</td></tr>}
            {!loading && tenants.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No tenants yet.</td></tr>}
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td>{t.contact_name}<br /><span className="text-gray-400">{t.contact_email}</span></td>
                <td className="capitalize">{t.deployment_mode}</td>
                <td>{t.billing_plan_name || <span className="text-gray-400">unassigned</span>}</td>
                <td><span className={`badge ${STATUS_BADGE[t.status] || 'badge-gray'}`}>{t.status}</span></td>
                <td><Link className="text-brand-600 hover:underline" href={`/tenants/${t.id}`}>Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateTenantModal plans={plans} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
