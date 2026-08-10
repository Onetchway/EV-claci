'use client';

import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { apiFetch } from '../../lib/api';
import { useAuthGuard } from '../../lib/useAuthGuard';

export default function UsersPage() {
  const ready = useAuthGuard();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', roleKey: 'FIELD_ENGINEER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const [usersData, rolesData] = await Promise.all([apiFetch('/users'), apiFetch('/roles')]);
    setUsers(usersData.users);
    setRoles(rolesData.roles);
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
      setForm({ name: '', email: '', phone: '', password: '', roleKey: 'FIELD_ENGINEER' });
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

  async function changeRole(user, roleKey) {
    await apiFetch(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ roleKey }) });
    await load();
  }

  if (!ready) return null;

  return (
    <>
      <Nav />
      <div className="page">
        <h1>Users &amp; Roles</h1>

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
              <select value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
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
                  <td>
                    <select value={u.roleKey || ''} onChange={(e) => changeRole(u, e.target.value)}>
                      {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  </td>
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
