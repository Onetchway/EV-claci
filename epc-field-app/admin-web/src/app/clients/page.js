'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { apiFetch } from '../../lib/api';
import { useAuthGuard } from '../../lib/useAuthGuard';

export default function ClientsPage() {
  const ready = useAuthGuard();
  const [clients, setClients] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiFetch('/clients');
    setClients(data.clients);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function createClient(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/clients', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
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
        <h1>Clients</h1>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Add a client</h2>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={createClient} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Client name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. V-Green India" />
            </div>
            <button className="btn" type="submit" disabled={loading}>Add</button>
          </form>
          <p className="muted" style={{ marginTop: 10 }}>
            A new client starts with no stage templates — their execution stages and report forms
            need to be seeded (see backend/prisma/seed.js for the V-Green pattern) before projects
            can be created for them.
          </p>
        </div>

        <div className="card">
          <table>
            <thead>
              <tr><th>Client</th><th>Created</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/clients/${c.id}`}>{c.name}</Link></td>
                  <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
