'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ScrollText } from 'lucide-react';

import { opsApi } from '@/lib/api';

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async (action) => {
    setLoading(true);
    try { setEntries((await opsApi.audit(action ? { action } : {})).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const search = (e) => {
    e.preventDefault();
    load(q);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Audit Log</h1>
          <p className="text-sm text-ink-500 mt-0.5">Every critical action taken across Alpha, most recent first.</p>
        </div>
        <form onSubmit={search} className="flex gap-2">
          <input className="input w-64" placeholder="Filter by action (e.g. tenant.created)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-secondary" type="submit">Filter</button>
        </form>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Organization</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state"><ScrollText className="h-5 w-5 text-ink-300" /><p className="empty-state-title">Nothing recorded yet</p></div></td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-ink-500 text-xs">{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.super_admin_name || <span className="text-ink-400">system</span>}</td>
                <td className="font-mono text-xs">{e.action}</td>
                <td>{e.tenant_name || '—'}</td>
                <td className="max-w-md truncate text-xs text-ink-500">{e.details ? JSON.stringify(e.details) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
