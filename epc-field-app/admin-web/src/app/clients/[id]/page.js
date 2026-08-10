'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';
import { apiFetch, getUser } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function ClientDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [stageTemplates, setStageTemplates] = useState([]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingDeps, setEditingDeps] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const canManage = (getUser()?.permissions || []).includes('clients.manage');

  async function load() {
    try {
      const [clientData, templatesData] = await Promise.all([
        apiFetch(`/clients/${id}`),
        apiFetch(`/clients/${id}/stage-templates`),
      ]);
      setClient(clientData.client);
      setStageTemplates(templatesData.stageTemplates);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, id]);

  function startEdit(stage) {
    setEditingId(stage.id);
    setEditingDeps(new Set(stage.dependsOnTemplateIds));
  }

  function toggleDep(depId) {
    setEditingDeps((prev) => {
      const next = new Set(prev);
      if (next.has(depId)) next.delete(depId);
      else next.add(depId);
      return next;
    });
  }

  async function saveDeps(stageId) {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/clients/${id}/stage-templates/${stageId}/dependencies`, {
        method: 'PUT',
        body: JSON.stringify({ dependsOnTemplateIds: [...editingDeps] }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  if (error && !client) return (<><Nav /><div className="page"><div className="error-box">{error}</div></div></>);
  if (!client) return (<><Nav /><div className="page">Loading…</div></>);

  const nameById = new Map(stageTemplates.map((st) => [st.id, st.name]));

  return (
    <>
      <Nav />
      <div className="page">
        <h1>{client.name}</h1>
        <p className="muted">Execution stages and their unlock dependencies.</p>
        {error && <div className="error-box">{error}</div>}

        <div className="card">
          <table>
            <thead>
              <tr><th>#</th><th>Stage</th><th>Depends on (must be approved first)</th><th></th></tr>
            </thead>
            <tbody>
              {stageTemplates.map((st) => (
                <tr key={st.id}>
                  <td>{st.order}</td>
                  <td>{st.name}</td>
                  <td>
                    {editingId === st.id ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                        {stageTemplates.filter((other) => other.id !== st.id).map((other) => (
                          <label key={other.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'normal' }}>
                            <input
                              type="checkbox"
                              checked={editingDeps.has(other.id)}
                              onChange={() => toggleDep(other.id)}
                            />
                            {other.name}
                          </label>
                        ))}
                      </div>
                    ) : st.dependsOnTemplateIds.length === 0 ? (
                      <span className="muted">None — unlocked immediately</span>
                    ) : (
                      st.dependsOnTemplateIds.map((depId) => nameById.get(depId)).filter(Boolean).join(', ')
                    )}
                  </td>
                  <td>
                    {!canManage ? null : editingId === st.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" disabled={saving} onClick={() => saveDeps(st.id)}>Save</button>
                        <button className="btn secondary" disabled={saving} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn secondary" onClick={() => startEdit(st)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {stageTemplates.length === 0 && (
                <tr><td colSpan={4} className="muted">No stage templates seeded for this client yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 10 }}>
            A stage unlocks once every stage it depends on is approved. Stages with no dependencies
            are workable as soon as a project is created — list more than one dependency to require
            parallel workstreams to finish before a downstream stage starts.
          </p>
        </div>
      </div>
    </>
  );
}
