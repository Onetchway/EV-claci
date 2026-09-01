'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { tenantsApi, featuresApi, billingPlansApi, invoicesApi, usageApi } from '@/lib/api';

export default function TenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [features, setFeatures] = useState([]);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [tenantRes, featuresRes, plansRes, invoicesRes, usageRes] = await Promise.all([
        tenantsApi.get(id),
        featuresApi.forTenant(id),
        billingPlansApi.list(),
        invoicesApi.list({ tenant_id: id }),
        usageApi.forTenant(id),
      ]);
      setTenant(tenantRes);
      setFeatures(featuresRes.data);
      setPlans(plansRes.data);
      setInvoices(invoicesRes.data);
      setUsage(usageRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleFeature = async (featureKey, enabled) => {
    setFeatures((prev) => prev.map((f) => (f.key === featureKey ? { ...f, enabled } : f)));
    try {
      await featuresApi.setForTenant(id, featureKey, enabled);
    } catch (err) {
      toast.error(err.message);
      load();
    }
  };

  const updateTenant = async (patch) => {
    try {
      const updated = await tenantsApi.update(id, patch);
      setTenant((prev) => ({ ...prev, ...updated }));
      toast.success('Saved.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const generateInvoice = async () => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    try {
      await invoicesApi.generate(id, {
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
      });
      toast.success('Invoice generated.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const rotateKey = async () => {
    try {
      const { api_key } = await tenantsApi.rotateApiKey(id);
      toast.success(`New API key: ${api_key}`, { duration: 10000 });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading || !tenant) return <div className="text-gray-400">Loading…</div>;

  const grouped = features.reduce((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-gray-500">{tenant.contact_email} · {tenant.deployment_mode} deployment</p>
        </div>
        <select className="input w-40" value={tenant.status} onChange={(e) => updateTenant({ status: e.target.value })}>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Billing</h2>
          <div>
            <label className="label">Plan</label>
            <select className="input" value={tenant.billing_plan_id || ''} onChange={(e) => updateTenant({ billing_plan_id: e.target.value || null })}>
              <option value="">— none —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Billing day of month</label>
            <input
              className="input"
              type="number" min="1" max="28"
              defaultValue={tenant.billing_day}
              onBlur={(e) => updateTenant({ billing_day: Number(e.target.value) })}
            />
          </div>
          <button className="btn-secondary" onClick={generateInvoice}>Generate invoice for last month</button>
          <button className="btn-secondary" onClick={rotateKey}>Rotate tenant API key</button>

          {usage.length > 0 && (
            <div>
              <div className="label mt-2">Reported employee counts (self-reported by tenant)</div>
              <ul className="text-sm text-gray-600 space-y-0.5">
                {usage.map((u) => (
                  <li key={u.id}>{u.period_month.slice(0, 7)}: {u.employee_count} employees</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Recent invoices</h2>
          {invoices.length === 0 && <p className="text-sm text-gray-400">No invoices yet.</p>}
          <ul className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <li key={inv.id} className="py-2 flex justify-between text-sm">
                <span>{inv.invoice_number}</span>
                <span>{inv.currency} {inv.total_amount}</span>
                <span className="capitalize">{inv.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Feature access</h2>
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">{category}</div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.enabled} onChange={(e) => toggleFeature(f.key, e.target.checked)} />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
