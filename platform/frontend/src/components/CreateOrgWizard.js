'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { tenantsApi, featuresApi } from '@/lib/api';

const STEPS = ['Organization', 'Plan', 'Features', 'Branding', 'Review'];

const emptyForm = {
  name: '', contact_name: '', contact_email: '', contact_phone: '',
  deployment_mode: 'shared', billing_plan_id: '', billing_day: 1,
  logo_url: '', primary_color_hex: '#4f46e5',
};

export default function CreateOrgWizard({ plans, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [catalog, setCatalog] = useState([]);
  // key -> enabled; starts from each feature's catalog default, only
  // touched entries are sent as an override after creation.
  const [featureState, setFeatureState] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    featuresApi.catalog().then((res) => {
      setCatalog(res.data);
      setFeatureState(Object.fromEntries(res.data.map((f) => [f.key, f.is_default_enabled])));
    }).catch((err) => toast.error(err.message));
  }, []);

  const selectedPlan = plans.find((p) => p.id === form.billing_plan_id);
  const grouped = useMemo(() => {
    const acc = {};
    for (const f of catalog) (acc[f.category] ||= []).push(f);
    return acc;
  }, [catalog]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const canProceed = {
    0: form.name.trim() && form.contact_name.trim() && form.contact_email.trim(),
    1: true,
    2: true,
    3: true,
    4: true,
  }[step];

  async function create() {
    setBusy(true);
    try {
      const created = await tenantsApi.create({
        ...form,
        billing_plan_id: form.billing_plan_id || null,
        logo_url: form.logo_url || null,
        primary_color_hex: form.primary_color_hex || null,
      });
      toast.success(`"${created.name}" created. API key: ${created.api_key}`, { duration: 10000 });

      const overrides = catalog
        .filter((f) => featureState[f.key] !== f.is_default_enabled)
        .map((f) => ({ feature_key: f.key, enabled: featureState[f.key] }));
      if (overrides.length) {
        await featuresApi.bulkSetForTenant(created.id, overrides).catch((err) => toast.error(`Feature access: ${err.message}`));
      }

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
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-2xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-lg font-semibold text-ink-900">New organization</h2>
          <button className="btn-ghost !px-2" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center gap-1.5 px-6 pt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500' : 'bg-ink-100 text-ink-400'
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${i === step ? 'text-ink-900' : 'text-ink-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-brand-300' : 'bg-ink-100'}`} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-6 min-h-[320px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Company name</label>
                <input className="input" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact name</label>
                  <input className="input" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Contact email</label>
                  <input className="input" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
                  <p className="hint">This becomes the tenant admin&apos;s login.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact phone</label>
                  <input className="input" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
                </div>
                <div>
                  <label className="label">Deployment mode</label>
                  <select className="select" value={form.deployment_mode} onChange={(e) => set('deployment_mode', e.target.value)}>
                    <option value="shared">Shared — shared hosting + shared database</option>
                    <option value="isolated">Isolated — shared hosting, separate database</option>
                    <option value="dedicated">Dedicated — client&apos;s own domain + hosting</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Billing plan</label>
                <select className="select" value={form.billing_plan_id} onChange={(e) => set('billing_plan_id', e.target.value)}>
                  <option value="">— assign later —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {selectedPlan && (
                <div className="card card-pad text-sm space-y-1.5 bg-ink-50/60">
                  <div className="flex justify-between"><span className="text-ink-500">Billing model</span><span className="capitalize text-ink-800">{selectedPlan.billing_model.replace('_', ' ')}</span></div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Rate</span>
                    <span className="text-ink-800">
                      {selectedPlan.billing_model === 'per_employee'
                        ? `${selectedPlan.currency} ${selectedPlan.per_employee_amount}/employee/mo`
                        : `${selectedPlan.currency} ${selectedPlan.fixed_monthly_amount}/mo`}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-ink-500">Tax</span><span className="text-ink-800">{selectedPlan.tax_percent}%</span></div>
                </div>
              )}
              <div>
                <label className="label">Billing day of month</label>
                <input className="input w-32" type="number" min="1" max="28" value={form.billing_day} onChange={(e) => set('billing_day', Number(e.target.value))} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-ink-500">Every feature starts at its plan default — toggle anything this tenant needs different.</p>
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">{category}</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {items.map((f) => (
                      <label key={f.key} className="flex items-center gap-2.5 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                          checked={!!featureState[f.key]}
                          onChange={(e) => setFeatureState((s) => ({ ...s, [f.key]: e.target.checked }))}
                        />
                        {f.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-ink-500">
                Shown from this tenant&apos;s very first login — logo on their sign-in page, accent color throughout their CRM.
                Optional; they can change it later in their own Settings.
              </p>
              <div>
                <label className="label">Logo URL</label>
                <input className="input" placeholder="https://…/logo.png" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} />
              </div>
              <div>
                <label className="label">Primary color</label>
                <div className="flex items-center gap-3">
                  <input type="color" className="h-9 w-14 rounded border border-ink-200" value={form.primary_color_hex} onChange={(e) => set('primary_color_hex', e.target.value)} />
                  <input className="input w-32" value={form.primary_color_hex} onChange={(e) => set('primary_color_hex', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="card card-pad space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-ink-500">Company</span><span className="font-medium text-ink-900">{form.name}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Admin</span><span className="text-ink-800">{form.contact_name} · {form.contact_email}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Deployment</span><span className="capitalize text-ink-800">{form.deployment_mode}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Plan</span><span className="text-ink-800">{selectedPlan?.name || 'unassigned'}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Features overridden</span><span className="text-ink-800">{catalog.filter((f) => featureState[f.key] !== f.is_default_enabled).length}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Branding</span><span className="text-ink-800">{form.logo_url ? 'Logo set' : 'No logo'}, <span className="inline-block h-3 w-3 rounded-full align-middle ml-1" style={{ background: form.primary_color_hex }} /></span></div>
              </div>
              <p className="text-xs text-ink-400">Creating provisions their real CRM login immediately — this isn&apos;t a draft.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 px-6 py-4">
          <button className="btn-secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}>
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" disabled={!canProceed} onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Creating…' : 'Create organization'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
