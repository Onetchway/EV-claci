'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

import { opsApi } from '@/lib/api';

const ICON = {
  healthy: <CheckCircle2 className="h-4 w-4 text-success-600" />,
  configured: <CheckCircle2 className="h-4 w-4 text-success-600" />,
  down: <XCircle className="h-4 w-4 text-danger-600" />,
  not_configured: <MinusCircle className="h-4 w-4 text-ink-300" />,
};

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setHealth(await opsApi.health()); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">System Health</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {health && `Last checked ${new Date(health.checked_at).toLocaleTimeString()} — overall: `}
            {health && <span className={health.overall === 'healthy' ? 'text-success-600 font-medium' : 'text-danger-600 font-medium'}>{health?.overall}</span>}
          </p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Re-check'}</button>
      </div>

      <div className="card">
        {loading && !health ? (
          <div className="card-pad text-ink-400 text-sm">Checking…</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {health?.checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-ink-700">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.latency_ms !== undefined && <span className="text-xs text-ink-400">{c.latency_ms}ms</span>}
                  {c.error && <span className="text-xs text-danger-600">{c.error}</span>}
                  {ICON[c.status] || <MinusCircle className="h-4 w-4 text-ink-300" />}
                  <span className="capitalize text-ink-600">{c.status.replace('_', ' ')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
