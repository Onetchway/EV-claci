'use client';

import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { apiFetch } from '../../lib/api';
import { useAuthGuard } from '../../lib/useAuthGuard';

export default function UsersPage() {
  const ready = useAuthGuard();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'ENGINEER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiFetch('/users');
    setUsers(data.users);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', phone: '', password: '', role: 'ENGINEER' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user) {
    await apiFetch(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) });
    await load();
  }

  if (!ready) return null;

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Engineers &amp; Admins</h1>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Add a user</h2>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={createUser} className="grid cols-2">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="ENGINEER">Engineer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div style={{ alignSelf: 'end', marginBottom: 12 }}>
              <button className="btn" type="submit" disabled={loading}>Create user</button>
            </div>
          </form>
        </div>

        <div className="card">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                  <td><button className="btn secondary" onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
