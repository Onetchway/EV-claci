'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Building2, Plus, Search } from 'lucide-react';

import { tenantsApi, billingPlansApi } from '@/lib/api';
import CreateOrgWizard from '@/components/CreateOrgWizard';

const STATUS_BADGE = {
  lead: 'badge-gray',
  trial: 'badge-yellow',
  active: 'badge-green',
  past_due: 'badge-yellow',
  paused: 'badge-gray',
  suspended: 'badge-red',
  cancelled: 'badge-gray',
  archived: 'badge-gray',
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const money = (n, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

export default function TenantsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-ink-400">Loading…</div>}>
      <TenantsPageInner />
    </Suspense>
  );
}

function TenantsPageInner() {
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState(searchParams.get('q') || '');

  const load = async () => {
    setLoading(true);
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        tenantsApi.list({ status: status || undefined, search: search || undefined, limit: 100 }),
        billingPlansApi.list(),
      ]);
      setTenants(tenantsRes.data);
      setPlans(plansRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status, search]);

  const counts = useMemo(() => {
    const c = {};
    for (const t of tenants) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tenants]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Organizations</h1>
          <p className="text-sm text-ink-500 mt-0.5">Every client running on Alpha.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New organization
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tab-list border-b-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`tab ${status === f.value ? 'tab-active' : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}{f.value && counts[f.value] ? ` (${counts[f.value]})` : ''}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search company, email, slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Users</th>
              <th>MRR</th>
              <th>Next billing</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center text-ink-400 py-10">Loading…</td></tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <Building2 className="h-6 w-6 text-ink-300" />
                    <p className="empty-state-title">No organizations match</p>
                    <p className="empty-state-text">Try a different filter, or create your first organization.</p>
                  </div>
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/tenants/${t.id}`} className="font-medium text-ink-900 hover:text-brand-700">{t.name}</Link>
                  <div className="text-xs text-ink-400">{t.contact_email}</div>
                </td>
                <td><span className={`badge ${STATUS_BADGE[t.status] || 'badge-gray'}`}>{t.status}</span></td>
                <td>{t.billing_plan_name || <span className="text-ink-400">unassigned</span>}</td>
                <td className="tabular-nums">{Number(t.users || 0).toLocaleString()}</td>
                <td className="tabular-nums">{Number(t.mrr) > 0 ? money(t.mrr) : <span className="text-ink-400">—</span>}</td>
                <td className="text-ink-500">{t.status === 'active' ? new Date(t.next_billing_at).toLocaleDateString() : <span className="text-ink-300">—</span>}</td>
                <td className="text-ink-500">{new Date(t.created_at).toLocaleDateString()}</td>
                <td><Link className="text-brand-600 hover:underline text-sm font-medium" href={`/tenants/${t.id}`}>Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateOrgWizard plans={plans} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
