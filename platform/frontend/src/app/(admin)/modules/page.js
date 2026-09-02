'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LayoutGrid } from 'lucide-react';

import { modulesApi } from '@/lib/api';

export default function ModulesPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setModules((await modulesApi.catalog()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleDefault = async (key, is_default_enabled) => {
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, is_default_enabled } : m)));
    try {
      await modulesApi.updateCatalog(key, { is_default_enabled });
    } catch (err) {
      toast.error(err.message);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Modules</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          The product areas a tenant can be given — a coarser on/off gate than an individual feature.
          Toggle a whole module off for a specific tenant from their own Organization page.
        </p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Description</th>
              <th>New tenants default to</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {!loading && modules.length === 0 && (
              <tr><td colSpan={3}><div className="empty-state"><LayoutGrid className="h-5 w-5 text-ink-300" /><p className="empty-state-title">No modules yet</p></div></td></tr>
            )}
            {modules.map((m) => (
              <tr key={m.key}>
                <td className="font-medium text-ink-900">{m.name}</td>
                <td className="text-ink-500 max-w-md">{m.description}</td>
                <td>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={m.is_default_enabled}
                      onChange={(e) => toggleDefault(m.key, e.target.checked)}
                    />
                    <span className="text-sm text-ink-600">{m.is_default_enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
