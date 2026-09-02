'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlayCircle } from 'lucide-react';

import { opsApi } from '@/lib/api';

const STATUS_BADGE = { succeeded: 'badge-green', failed: 'badge-red', running: 'badge-yellow' };

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setJobs((await opsApi.jobs()).data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const runNow = async (name) => {
    setRunning(name);
    try {
      await opsApi.runJob(name);
      toast.success('Job completed.');
      load();
    } catch (err) {
      toast.error(err.message);
      load();
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Background Jobs</h1>
        <p className="text-sm text-ink-500 mt-0.5">Scheduled daily; run any of them on demand.</p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Last run</th>
              <th>Status</th>
              <th>Trigger</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center text-ink-400 py-10">Loading…</td></tr>}
            {jobs.map((j) => (
              <tr key={j.name}>
                <td className="font-medium text-ink-900">{j.label}</td>
                <td className="text-ink-500 text-xs">{j.last_run ? new Date(j.last_run.started_at).toLocaleString() : 'Never run'}</td>
                <td>
                  {j.last_run ? (
                    <span className={`badge ${STATUS_BADGE[j.last_run.status] || 'badge-gray'}`}>{j.last_run.status}</span>
                  ) : <span className="badge badge-gray">—</span>}
                  {j.last_run?.error && <p className="text-xs text-danger-600 mt-1 max-w-xs truncate">{j.last_run.error}</p>}
                </td>
                <td className="capitalize text-ink-500">{j.last_run?.trigger || '—'}</td>
                <td>
                  <button className="btn-secondary" disabled={running === j.name} onClick={() => runNow(j.name)}>
                    <PlayCircle className="h-4 w-4" /> {running === j.name ? 'Running…' : 'Run now'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
