'use client';

import { Fragment, useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { apiFetch } from '../../lib/api';
import { useAuthGuard } from '../../lib/useAuthGuard';

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const ready = useAuthGuard();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (entityType) params.set('entityType', entityType);
      const data = await apiFetch(`/audit-logs?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, offset, entityType]);

  if (!ready) return null;

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Audit Log</h1>
        {error && <div className="error-box">{error}</div>}

        <div className="card">
          <div className="field" style={{ maxWidth: 260 }}>
            <label>Filter by entity type</label>
            <select
              value={entityType}
              onChange={(e) => { setOffset(0); setEntityType(e.target.value); }}
            >
              <option value="">All</option>
              <option value="Project">Project</option>
              <option value="User">User</option>
              <option value="Client">Client</option>
              <option value="ProjectStage">ProjectStage</option>
            </select>
          </div>

          <table>
            <thead>
              <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th></th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.actor?.name || '—'}</td>
                    <td>{log.action}</td>
                    <td>{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}</td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {expandedId === log.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={5}>
                        <div className="grid cols-2">
                          <div>
                            <strong>Before</strong>
                            <pre>{JSON.stringify(log.beforeJson, null, 2) || '—'}</pre>
                          </div>
                          <div>
                            <strong>After</strong>
                            <pre>{JSON.stringify(log.afterJson, null, 2) || '—'}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="muted">No audit log entries.</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button className="btn secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              ← Previous
            </button>
            <span className="muted">{total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
            <button className="btn secondary" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
