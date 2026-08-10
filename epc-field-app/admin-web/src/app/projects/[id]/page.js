'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';
import StatusBadge from '../../../components/StatusBadge';
import ConfigEditor from '../../../components/ConfigEditor';
import { apiFetch } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function ProjectDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [canAssignMembers, setCanAssignMembers] = useState(false);
  const [canManageProject, setCanManageProject] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRoleId, setNewMemberRoleId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [data, configData] = await Promise.all([
        apiFetch(`/projects/${id}`),
        apiFetch(`/projects/${id}/config`),
      ]);
      setProject(data.project);
      setMilestones(data.paymentMilestones);
      setCanAssignMembers(!!data.canAssignMembers);
      setCanManageProject(!!data.canManageProject);
      setConfigs(configData.configs);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveConfig(key, value) {
    await apiFetch(`/projects/${id}/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
    await load();
  }

  async function clearConfig(key) {
    await apiFetch(`/projects/${id}/config/${key}`, { method: 'DELETE' });
    await load();
  }

  async function loadTeamOptions() {
    try {
      const [rolesData, usersData] = await Promise.all([apiFetch('/roles'), apiFetch('/users')]);
      setRoles(rolesData.roles);
      setUsers(usersData.users);
    } catch (err) {
      // Non-fatal — team options are only needed when adding a member.
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, id]);

  useEffect(() => {
    if (ready && canAssignMembers) loadTeamOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canAssignMembers]);

  async function addMember(e) {
    e.preventDefault();
    if (!newMemberUserId || !newMemberRoleId) return;
    try {
      await apiFetch(`/projects/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: newMemberUserId, roleId: newMemberRoleId }),
      });
      setNewMemberUserId('');
      setNewMemberRoleId('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMember(memberId) {
    try {
      await apiFetch(`/projects/${id}/members/${memberId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) return null;
  if (error) return (<><Nav /><div className="page"><div className="error-box">{error}</div></div></>);
  if (!project) return (<><Nav /><div className="page">Loading…</div></>);

  return (
    <>
      <Nav />
      <div className="page">
        <h1>{project.siteName}</h1>
        <p className="muted">{project.client?.name} — {project.address}</p>

        <div className="grid cols-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Execution Stages</h2>
            <table>
              <thead><tr><th>#</th><th>Stage</th><th>Status</th></tr></thead>
              <tbody>
                {project.stages.map((s) => (
                  <tr key={s.id}>
                    <td>{s.stageTemplate.order}</td>
                    <td>
                      {s.status === 'LOCKED'
                        ? s.stageTemplate.name
                        : <Link href={`/stages/${s.id}`}>{s.stageTemplate.name}</Link>}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Payment Milestones</h2>
            {milestones.map((m) => (
              <div className="milestone-row" key={m.key}>
                <span><span className={`dot ${m.achieved ? 'achieved' : 'pending'}`} />{m.label}</span>
                <strong>{m.percent}%{m.achieved ? ' ✓' : ''}</strong>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 10 }}>
              Derived automatically from stage approvals per the V-Green Playbook §12 payment terms.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Team</h2>
          {error && <div className="error-box">{error}</div>}
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Project Role</th><th></th></tr></thead>
            <tbody>
              {(project.members || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.user.name}</td>
                  <td>{m.user.email}</td>
                  <td>{m.role.name}</td>
                  <td>
                    {canAssignMembers && (
                      <button className="btn secondary" onClick={() => removeMember(m.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
              {(project.members || []).length === 0 && (
                <tr><td colSpan={4} className="muted">No team members added yet.</td></tr>
              )}
            </tbody>
          </table>

          {canAssignMembers && (
            <form onSubmit={addMember} className="grid cols-2" style={{ marginTop: 16 }}>
              <div className="field">
                <label>User</label>
                <select value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)} required>
                  <option value="">Select a user…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Project role</label>
                <select value={newMemberRoleId} onChange={(e) => setNewMemberRoleId(e.target.value)} required>
                  <option value="">Select a role…</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ alignSelf: 'end', marginBottom: 12 }}>
                <button className="btn" type="submit">Add to team</button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Configuration</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Overrides for this project only. Anything not overridden here uses the client's default.
          </p>
          <ConfigEditor
            configs={configs}
            canManage={canManageProject}
            onSave={saveConfig}
            onClear={clearConfig}
            inheritedLabel="Client default"
          />
        </div>
      </div>
    </>
  );
}
