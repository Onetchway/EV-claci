'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Building2, IndianRupee, Key, Receipt, RefreshCw, Users,
} from 'lucide-react';

import {
  tenantsApi, featuresApi, billingPlansApi, invoicesApi, usageApi, provisioningApi,
  addOnsApi, couponsApi, creditsApi,
} from '@/lib/api';

const STATUS_BADGE = {
  active: 'badge-green',
  trial: 'badge-yellow',
  suspended: 'badge-red',
  cancelled: 'badge-gray',
};

const money = (n, currency) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TABS = ['Overview', 'Billing', 'Features', 'Domains'];

export default function TenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [features, setFeatures] = useState([]);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [tab, setTab] = useState('Overview');

  const [addOnCatalog, setAddOnCatalog] = useState([]);
  const [tenantAddOns, setTenantAddOns] = useState([]);
  const [couponCatalog, setCouponCatalog] = useState([]);
  const [tenantCoupons, setTenantCoupons] = useState([]);
  const [credits, setCredits] = useState({ data: [], balance: 0 });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [
        tenantRes, featuresRes, plansRes, invoicesRes, usageRes,
        addOnCatalogRes, tenantAddOnsRes, couponCatalogRes, tenantCouponsRes, creditsRes,
      ] = await Promise.all([
        tenantsApi.get(id),
        featuresApi.forTenant(id),
        billingPlansApi.list(),
        invoicesApi.list({ tenant_id: id }),
        usageApi.forTenant(id),
        addOnsApi.catalog(),
        addOnsApi.forTenant(id),
        couponsApi.list(),
        couponsApi.forTenant(id),
        creditsApi.forTenant(id),
      ]);
      setTenant(tenantRes);
      setFeatures(featuresRes.data);
      setPlans(plansRes.data);
      setInvoices(invoicesRes.data);
      setUsage(usageRes.data);
      setAddOnCatalog(addOnCatalogRes.data);
      setTenantAddOns(tenantAddOnsRes.data);
      setCouponCatalog(couponCatalogRes.data);
      setTenantCoupons(tenantCouponsRes.data);
      setCredits(creditsRes);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const currentPeriod = () => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  };

  const loadPreview = async () => {
    const { start, end } = currentPeriod();
    setPreviewLoading(true);
    try {
      const data = await invoicesApi.preview(id, {
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
      });
      setPreview(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const attachAddOn = async (addOnId) => {
    if (!addOnId) return;
    try {
      await addOnsApi.attachToTenant(id, addOnId);
      toast.success('Add-on attached.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const detachAddOn = async (addOnId) => {
    try {
      await addOnsApi.detachFromTenant(id, addOnId);
      toast.success('Add-on removed.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const assignCoupon = async (couponId) => {
    if (!couponId) return;
    try {
      await couponsApi.assignToTenant(id, couponId);
      toast.success('Coupon assigned.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const unassignCoupon = async (tenantCouponId) => {
    try {
      await couponsApi.unassignFromTenant(id, tenantCouponId);
      toast.success('Coupon unassigned.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addCredit = async () => {
    const amount = window.prompt('Credit amount (use a negative number to deduct):');
    if (!amount || Number.isNaN(Number(amount))) return;
    const reason = window.prompt('Reason (optional):') || undefined;
    try {
      await creditsApi.addCredit(id, Number(amount), reason);
      toast.success('Credit recorded.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [branding, setBranding] = useState({ logo_url: '', primary_color_hex: '' });
  const [brandingSaving, setBrandingSaving] = useState(false);

  useEffect(() => {
    if (tenant) setBranding({ logo_url: tenant.logo_url || '', primary_color_hex: tenant.primary_color_hex || '' });
  }, [tenant]);

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      const { crmSync } = await tenantsApi.updateBranding(id, branding);
      if (crmSync?.ok) toast.success('Branding updated — synced to the tenant’s CRM.');
      else if (crmSync?.configured) toast.error('Saved, but could not sync to the tenant’s CRM — check the platform backend logs.');
      else toast.success('Branding saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBrandingSaving(false);
    }
  };

  const rotateKey = async () => {
    try {
      const { api_key, crmSync } = await tenantsApi.rotateApiKey(id);
      toast.success(`New API key: ${api_key}`, { duration: 10000 });
      // Only meaningful when CRM_PROVISION_URL/SECRET are configured on
      // this platform backend — see tenants.service.js's rotateApiKey().
      // Re-syncs this tenant's feature access into their CRM, so this is
      // also the fix for "I disabled a feature but the tenant's CRM still
      // shows it" on a tenant provisioned before that wiring existed.
      if (crmSync?.ok) {
        toast.success('Synced to the tenant’s CRM — their feature access is now up to date.', { duration: 8000 });
      } else if (crmSync?.configured) {
        toast.error('Could not sync the new key to the tenant’s CRM — check the platform backend logs.', { duration: 8000 });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const provisionDatabase = async () => {
    setProvisioning(true);
    try {
      const { connection_string } = await provisioningApi.provisionIsolatedDatabase(id);
      toast.success(`Database ready. Connection string (save now, shown once): ${connection_string}`, { duration: 20000 });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  if (loading || !tenant) return <div className="animate-pulse text-sm text-ink-400">Loading…</div>;

  const grouped = features.reduce((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{tenant.name}</h1>
              <span className={`badge ${STATUS_BADGE[tenant.status] || 'badge-gray'}`}>{tenant.status}</span>
            </div>
            <p className="text-sm text-ink-500 mt-0.5">{tenant.contact_email} · {tenant.deployment_mode} deployment</p>
          </div>
        </div>
        <select className="select w-40" value={tenant.status} onChange={(e) => updateTenant({ status: e.target.value })}>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card">
          <span className="stat-label">Plan</span>
          <span className="stat-value text-base">{tenant.billing_plan_name || '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Users</span>
          <span className="stat-value">{Number(tenant.users || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">MRR</span>
          <span className="stat-value">{Number(tenant.mrr) > 0 ? money(tenant.mrr, tenant.currency) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Next billing</span>
          <span className="stat-value text-base">{tenant.status === 'active' ? new Date(tenant.next_billing_at).toLocaleDateString() : '—'}</span>
        </div>
      </div>

      <div className="tab-list">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="card-header"><p className="card-title">Account</p></div>
            <dl className="card-pad space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Contact</dt><dd className="text-ink-800">{tenant.contact_name}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Email</dt><dd className="text-ink-800">{tenant.contact_email}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Phone</dt><dd className="text-ink-800">{tenant.contact_phone || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Deployment</dt><dd className="text-ink-800 capitalize">{tenant.deployment_mode}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Created</dt><dd className="text-ink-800">{new Date(tenant.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>

          <div className="card">
            <div className="card-header"><p className="card-title">Recent invoices</p></div>
            {invoices.length === 0 ? (
              <div className="empty-state"><Receipt className="h-5 w-5 text-ink-300" /><p className="empty-state-title">No invoices yet</p></div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {invoices.slice(0, 6).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-ink-700">{inv.invoice_number}</span>
                    <span className="font-medium text-ink-900">{money(inv.total_amount, inv.currency)}</span>
                    <span className="capitalize text-ink-500">{inv.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'Billing' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card card-pad space-y-4">
            <div>
              <label className="label">Plan</label>
              <select className="select" value={tenant.billing_plan_id || ''} onChange={(e) => updateTenant({ billing_plan_id: e.target.value || null })}>
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
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-secondary" onClick={generateInvoice}>
                <IndianRupee className="h-4 w-4" /> Generate invoice for last month
              </button>
              <button className="btn-secondary" onClick={rotateKey}>
                <Key className="h-4 w-4" /> Rotate tenant API key
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Reported employee counts</p>
                <p className="card-subtitle">Self-reported by the tenant&apos;s CRM</p>
              </div>
            </div>
            <div className="card-pad">
              {usage.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {usage.map((u) => (
                    <li key={u.id} className="flex justify-between">
                      <span className="text-ink-500">{new Date(`${u.period_month.slice(0, 7)}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                      <span className="font-medium text-ink-800">{u.employee_count} employees</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <Users className="h-5 w-5 text-ink-300" />
                  <p className="empty-state-title">Nothing reported yet</p>
                  <p className="empty-state-text">
                    Fills in once this tenant&apos;s CRM calls its usage-reporting endpoint — it needs their
                    API key set first (see &quot;Rotate tenant API key&quot;).
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><p className="card-title">Add-ons</p></div>
            <div className="card-pad space-y-3">
              <select className="select" value="" onChange={(e) => attachAddOn(e.target.value)}>
                <option value="">+ Attach an add-on…</option>
                {addOnCatalog
                  .filter((a) => a.is_active && !tenantAddOns.some((t) => t.add_on_id === a.id && t.active))
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name} — {a.currency} {a.amount}/mo</option>
                  ))}
              </select>
              {tenantAddOns.filter((t) => t.active).length === 0 ? (
                <p className="text-sm text-ink-400">No add-ons attached.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {tenantAddOns.filter((t) => t.active).map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink-700">{t.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-ink-900">{t.currency} {t.effective_amount}/mo</span>
                        <button className="text-danger-600 hover:underline" onClick={() => detachAddOn(t.add_on_id)}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><p className="card-title">Coupons</p></div>
            <div className="card-pad space-y-3">
              <select className="select" value="" onChange={(e) => assignCoupon(e.target.value)}>
                <option value="">+ Assign a coupon…</option>
                {couponCatalog
                  .filter((c) => c.is_active && !tenantCoupons.some((t) => t.coupon_id === c.id && t.active))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.discount_type === 'percent' ? `${c.amount}% off` : `${c.amount} off`}</option>
                  ))}
              </select>
              {tenantCoupons.filter((t) => t.active).length === 0 ? (
                <p className="text-sm text-ink-400">No coupons assigned.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {tenantCoupons.filter((t) => t.active).map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-mono text-ink-700">{t.code}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-ink-500">
                          {t.duration_invoices ? `${t.invoices_applied}/${t.duration_invoices} used` : `${t.invoices_applied} used`}
                        </span>
                        <button className="text-danger-600 hover:underline" onClick={() => unassignCoupon(t.id)}>Unassign</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Credits</p>
                <p className="card-subtitle">Balance: {money(credits.balance, tenant.currency)}</p>
              </div>
              <button className="btn-secondary" onClick={addCredit}>+ Adjust</button>
            </div>
            <div className="card-pad">
              {credits.data.length === 0 ? (
                <p className="text-sm text-ink-400">No credit activity yet.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {credits.data.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink-500">{new Date(c.created_at).toLocaleDateString()} — {c.reason || (c.amount < 0 ? 'Applied to invoice' : 'Manual credit')}</span>
                      <span className={`font-medium ${c.amount < 0 ? 'text-danger-600' : 'text-success-600'}`}>
                        {c.amount < 0 ? '-' : '+'}{money(Math.abs(c.amount), tenant.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card lg:col-span-2">
            <div className="card-header">
              <p className="card-title">Preview next invoice</p>
              <button className="btn-secondary" onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? 'Calculating…' : 'Calculate this month'}
              </button>
            </div>
            {preview && (
              <div className="card-pad">
                <dl className="space-y-1.5 text-sm max-w-sm">
                  <div className="flex justify-between"><dt className="text-ink-500">Base charge</dt><dd className="text-ink-800">{money(preview.base_subtotal, preview.currency)}</dd></div>
                  {preview.add_on_amount > 0 && (
                    <div className="flex justify-between"><dt className="text-ink-500">Add-ons</dt><dd className="text-ink-800">{money(preview.add_on_amount, preview.currency)}</dd></div>
                  )}
                  {preview.discount_amount > 0 && (
                    <div className="flex justify-between"><dt className="text-ink-500">Coupon ({preview.coupon_code})</dt><dd className="text-danger-600">-{money(preview.discount_amount, preview.currency)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-ink-500">Tax ({preview.tax_percent}%)</dt><dd className="text-ink-800">{money(preview.tax_amount, preview.currency)}</dd></div>
                  {preview.credit_applied > 0 && (
                    <div className="flex justify-between"><dt className="text-ink-500">Credit applied</dt><dd className="text-danger-600">-{money(preview.credit_applied, preview.currency)}</dd></div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-ink-100 font-semibold"><dt className="text-ink-900">Total</dt><dd className="text-ink-900">{money(preview.total_amount, preview.currency)}</dd></div>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Features' && (
        <div className="card card-pad space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">{category}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {items.map((f) => (
                  <label key={f.key} className="flex items-center gap-2.5 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={f.enabled}
                      onChange={(e) => toggleFeature(f.key, e.target.checked)}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Domains' && (
        <div className="space-y-4">
          <div className="card card-pad space-y-4">
            <div>
              <p className="card-title">Branding</p>
              <p className="text-sm text-ink-500 mt-0.5">
                Shown on this tenant&apos;s CRM login page and sidebar. Values here overwrite whatever the
                tenant has set themselves — leave a field blank to clear it.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Logo URL</label>
                <input
                  className="input"
                  placeholder="https://…/logo.png"
                  value={branding.logo_url}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Primary color</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder="#4f46e5"
                    value={branding.primary_color_hex}
                    onChange={(e) => setBranding({ ...branding, primary_color_hex: e.target.value })}
                  />
                  {/^#[0-9a-fA-F]{6}$/.test(branding.primary_color_hex) && (
                    <span className="h-9 w-9 shrink-0 rounded-lg border border-ink-200" style={{ backgroundColor: branding.primary_color_hex }} />
                  )}
                </div>
              </div>
            </div>
            <button className="btn-secondary" disabled={brandingSaving} onClick={saveBranding}>
              {brandingSaving ? 'Saving…' : 'Save branding'}
            </button>
          </div>

          <div className="card card-pad space-y-4">
          <p className="text-sm text-ink-500">
            Only used in <strong>shared</strong> deployment mode — one CRM instance resolves which
            tenant an inbound request belongs to by its subdomain or custom domain. Dedicated/isolated
            tenants ignore this (their whole instance already belongs to one tenant).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Subdomain</label>
              <div className="flex items-center gap-1.5">
                <input className="input" defaultValue={tenant.slug} onBlur={(e) => updateTenant({ slug: e.target.value })} />
                <span className="text-sm text-ink-400 whitespace-nowrap">.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'yourplatform.com'}</span>
              </div>
            </div>
            <div>
              <label className="label">Custom domain (optional)</label>
              <input
                className="input"
                placeholder="crm.clientcompany.com"
                defaultValue={tenant.custom_domain || ''}
                onBlur={(e) => updateTenant({ custom_domain: e.target.value || null })}
              />
            </div>
          </div>

          {tenant.deployment_mode === 'isolated' && (
            <div className="pt-2 border-t border-ink-100 space-y-3">
              <p className="text-sm text-ink-500">
                Isolated-mode tenants get their own Postgres database on your infra. Provisioning creates it
                and loads the full CRM schema — the connection string (with credentials) is shown once here;
                the platform only keeps a credential-free reference afterward.
              </p>
              {tenant.db_connection_ref ? (
                <p className="text-sm text-ink-700">
                  Provisioned: <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">{tenant.db_connection_ref}</code>
                </p>
              ) : (
                <button className="btn-secondary" disabled={provisioning} onClick={provisionDatabase}>
                  <RefreshCw className={`h-4 w-4 ${provisioning ? 'animate-spin' : ''}`} />
                  {provisioning ? 'Provisioning…' : 'Provision isolated database'}
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
