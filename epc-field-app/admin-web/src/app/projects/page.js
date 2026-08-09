'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { apiFetch } from '../../lib/api';
import { useAuthGuard } from '../../lib/useAuthGuard';

export default function ProjectsPage() {
  const ready = useAuthGuard();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [form, setForm] = useState({ clientId: '', siteName: '', address: '', assignedEngineerId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [projectsData, clientsData] = await Promise.all([apiFetch('/projects'), apiFetch('/clients')]);
    setProjects(projectsData.projects);
    setClients(clientsData.clients);
    try {
      const usersData = await apiFetch('/users');
      setEngineers(usersData.users.filter((u) => u.role === 'ENGINEER'));
    } catch {
      // non-admin users can't list users; ignore
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function createProject(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ ...form, assignedEngineerId: form.assignedEngineerId || undefined }),
      });
      setForm({ clientId: '', siteName: '', address: '', assignedEngineerId: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Projects</h1>
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ New Project'}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>New project</h2>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={createProject} className="grid cols-2">
              <div className="field">
                <label>Client</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Site name</label>
                <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} required />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div className="field">
                <label>Assign engineer</label>
                <select value={form.assignedEngineerId} onChange={(e) => setForm({ ...form, assignedEngineerId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {engineers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ alignSelf: 'end', marginBottom: 12 }}>
                <button className="btn" type="submit" disabled={loading}>Create project</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <table>
            <thead>
              <tr><th>Site</th><th>Client</th><th>Engineer</th><th>Progress</th><th>Status</th></tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/projects/${p.id}`}>{p.siteName}</Link><div className="muted">{p.address}</div></td>
                  <td>{p.client?.name}</td>
                  <td>{p.assignedEngineer?.name || <span className="muted">Unassigned</span>}</td>
                  <td>
                    {p.stageProgress.approved}/{p.stageProgress.total} stages approved
                    <div className="progress-track" style={{ marginTop: 4 }}>
                      <div className="progress-fill" style={{ width: `${(p.stageProgress.approved / p.stageProgress.total) * 100}%` }} />
                    </div>
                  </td>
                  <td>{p.status}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={5} className="muted">No projects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
