'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';
import ConfigEditor from '../../../components/ConfigEditor';
import MilestoneForm from '../../../components/MilestoneForm';
import StageTemplateEditor from '../../../components/StageTemplateEditor';
import { apiFetch, getUser } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function ClientDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [stageTemplates, setStageTemplates] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [roles, setRoles] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingDeps, setEditingDeps] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageDraft, setNewStageDraft] = useState({ key: '', name: '' });

  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleDraft, setRuleDraft] = useState({ requiredApprovals: 1, eligibleRoleKeys: new Set() });

  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [milestoneDraft, setMilestoneDraft] = useState(null);

  const canManage = (getUser()?.permissions || []).includes('clients.manage');

  async function load() {
    try {
      const [clientData, templatesData, configData, rolesData, milestonesData] = await Promise.all([
        apiFetch(`/clients/${id}`),
        apiFetch(`/clients/${id}/stage-templates`),
        apiFetch(`/clients/${id}/config`),
        apiFetch('/roles'),
        apiFetch(`/clients/${id}/payment-milestones`),
      ]);
      setClient(clientData.client);
      setStageTemplates(templatesData.stageTemplates);
      setConfigs(configData.configs);
      setRoles(rolesData.roles);
      setMilestones(milestonesData.milestones);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveConfig(key, value) {
    await apiFetch(`/clients/${id}/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
    await load();
  }

  async function clearConfig(key) {
    await apiFetch(`/clients/${id}/config/${key}`, { method: 'DELETE' });
    await load();
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, id]);

  async function createStage() {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/clients/${id}/stage-templates`, { method: 'POST', body: JSON.stringify(newStageDraft) });
      setAddingStage(false);
      setNewStageDraft({ key: '', name: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteStage(stageId) {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/clients/${id}/stage-templates/${stageId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

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

  function startEditRule(stage) {
    setEditingRuleId(stage.id);
    setRuleDraft({
      requiredApprovals: stage.approvalRule.requiredApprovals,
      eligibleRoleKeys: new Set(stage.approvalRule.eligibleRoleKeys),
    });
  }

  function toggleRuleRole(roleKey) {
    setRuleDraft((prev) => {
      const next = new Set(prev.eligibleRoleKeys);
      if (next.has(roleKey)) next.delete(roleKey);
      else next.add(roleKey);
      return { ...prev, eligibleRoleKeys: next };
    });
  }

  async function saveRule(stageId) {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/clients/${id}/stage-templates/${stageId}/approval-rule`, {
        method: 'PUT',
        body: JSON.stringify({
          requiredApprovals: Number(ruleDraft.requiredApprovals),
          eligibleRoleKeys: [...ruleDraft.eligibleRoleKeys],
        }),
      });
      setEditingRuleId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function blankMilestoneDraft() {
    return {
      key: '', label: '', percent: 10, order: milestones.length + 1,
      ruleType: 'statusIn', stageKeys: new Set(), statuses: new Set(['APPROVED']),
      daysStageKey: '', days: 365, requiresMilestoneKey: '',
    };
  }

  function startAddMilestone() {
    setEditingMilestoneId('__new__');
    setMilestoneDraft(blankMilestoneDraft());
  }

  function startEditMilestone(m) {
    setEditingMilestoneId(m.id);
    const rule = m.ruleJson;
    setMilestoneDraft({
      key: m.key, label: m.label, percent: m.percent, order: m.order,
      ruleType: rule.type,
      stageKeys: new Set(rule.stageKeys || []),
      statuses: new Set(rule.statuses || ['APPROVED']),
      daysStageKey: rule.stageKey || '',
      days: rule.days || 365,
      requiresMilestoneKey: rule.requiresMilestoneKey || '',
    });
  }

  function draftToRuleJson(d) {
    if (d.ruleType === 'statusIn') {
      return { type: 'statusIn', stageKeys: [...d.stageKeys], statuses: [...d.statuses] };
    }
    return {
      type: 'daysAfterStageApproval',
      stageKey: d.daysStageKey,
      days: Number(d.days),
      ...(d.requiresMilestoneKey && { requiresMilestoneKey: d.requiresMilestoneKey }),
    };
  }

  async function saveMilestone() {
    setSaving(true);
    setError('');
    try {
      const ruleJson = draftToRuleJson(milestoneDraft);
      const body = { label: milestoneDraft.label, percent: Number(milestoneDraft.percent), order: Number(milestoneDraft.order), ruleJson };
      if (editingMilestoneId === '__new__') {
        await apiFetch(`/clients/${id}/payment-milestones`, {
          method: 'POST',
          body: JSON.stringify({ ...body, key: milestoneDraft.key }),
        });
      } else {
        await apiFetch(`/clients/${id}/payment-milestones/${editingMilestoneId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      setEditingMilestoneId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMilestone(milestoneId) {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/clients/${id}/payment-milestones/${milestoneId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function describeRule(rule) {
    if (rule.type === 'statusIn') {
      return `${rule.stageKeys.join(' + ')} reaches ${rule.statuses.join('/')}`;
    }
    if (rule.type === 'daysAfterStageApproval') {
      return `${rule.days} days after ${rule.stageKey} approved${rule.requiresMilestoneKey ? ` (after ${rule.requiresMilestoneKey})` : ''}`;
    }
    return JSON.stringify(rule);
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
              <tr><th>#</th><th>Stage</th><th>Depends on (must be approved first)</th><th>Form</th><th></th></tr>
            </thead>
            <tbody>
              {stageTemplates.map((st) => (
                <Fragment key={st.id}>
                  <tr>
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
                      <button className="btn secondary" onClick={() => setExpandedStageId(expandedStageId === st.id ? null : st.id)}>
                        {expandedStageId === st.id ? 'Hide' : `Manage (${st.fieldDefs.length} field${st.fieldDefs.length === 1 ? '' : 's'}, ${st.photoSlots.length} photo${st.photoSlots.length === 1 ? '' : 's'})`}
                      </button>
                    </td>
                    <td>
                      {!canManage ? null : editingId === st.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" disabled={saving} onClick={() => saveDeps(st.id)}>Save</button>
                          <button className="btn secondary" disabled={saving} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn secondary" onClick={() => startEdit(st)}>Depends on</button>
                          <button className="btn secondary" disabled={saving} onClick={() => deleteStage(st.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedStageId === st.id && (
                    <tr>
                      <td colSpan={5}>
                        <StageTemplateEditor clientId={id} stage={st} onChanged={load} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {stageTemplates.length === 0 && (
                <tr><td colSpan={5} className="muted">No stage templates yet — add one below.</td></tr>
              )}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 10 }}>
            A stage unlocks once every stage it depends on is approved. Stages with no dependencies
            are workable as soon as a project is created — list more than one dependency to require
            parallel workstreams to finish before a downstream stage starts.
          </p>

          {canManage && (
            addingStage ? (
              <div className="grid cols-2" style={{ marginTop: 12, gap: 10 }}>
                <div className="field">
                  <label>Key (machine name, e.g. SITE_SURVEY)</label>
                  <input value={newStageDraft.key} onChange={(e) => setNewStageDraft((p) => ({ ...p, key: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Name</label>
                  <input value={newStageDraft.name} onChange={(e) => setNewStageDraft((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                  <button className="btn" disabled={saving || !newStageDraft.key || !newStageDraft.name} onClick={createStage}>Add stage</button>
                  <button className="btn secondary" disabled={saving} onClick={() => { setAddingStage(false); setNewStageDraft({ key: '', name: '' }); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn" style={{ marginTop: 12 }} onClick={() => setAddingStage(true)}>+ Add stage</button>
            )
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Approval Rules</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            How many approvals a stage needs before it counts as APPROVED, and which roles may give one.
            Leave roles empty to allow anyone with the stages.approve permission.
          </p>
          <table>
            <thead><tr><th>Stage</th><th>Required approvals</th><th>Eligible roles</th><th></th></tr></thead>
            <tbody>
              {stageTemplates.map((st) => (
                <tr key={st.id}>
                  <td>{st.name}</td>
                  <td>
                    {editingRuleId === st.id ? (
                      <input
                        type="number"
                        min={1}
                        style={{ width: 60 }}
                        value={ruleDraft.requiredApprovals}
                        onChange={(e) => setRuleDraft((p) => ({ ...p, requiredApprovals: e.target.value }))}
                      />
                    ) : (
                      st.approvalRule.requiredApprovals
                    )}
                  </td>
                  <td>
                    {editingRuleId === st.id ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                        {roles.map((r) => (
                          <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'normal' }}>
                            <input
                              type="checkbox"
                              checked={ruleDraft.eligibleRoleKeys.has(r.key)}
                              onChange={() => toggleRuleRole(r.key)}
                            />
                            {r.name}
                          </label>
                        ))}
                      </div>
                    ) : st.approvalRule.eligibleRoleKeys.length === 0 ? (
                      <span className="muted">Anyone eligible</span>
                    ) : (
                      st.approvalRule.eligibleRoleKeys.join(', ')
                    )}
                  </td>
                  <td>
                    {!canManage ? null : editingRuleId === st.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" disabled={saving} onClick={() => saveRule(st.id)}>Save</button>
                        <button className="btn secondary" disabled={saving} onClick={() => setEditingRuleId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn secondary" onClick={() => startEditRule(st)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {stageTemplates.length === 0 && (
                <tr><td colSpan={4} className="muted">No stage templates seeded for this client yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Payment Milestones</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            The client's payment schedule, derived automatically from stage statuses.
          </p>
          <table>
            <thead><tr><th>Milestone</th><th>%</th><th>Achieved when</th><th></th></tr></thead>
            <tbody>
              {milestones.map((m) => (
                editingMilestoneId === m.id ? (
                  <tr key={m.id}>
                    <td colSpan={4}>
                      <MilestoneForm
                        draft={milestoneDraft}
                        setDraft={setMilestoneDraft}
                        stageTemplates={stageTemplates}
                        milestones={milestones}
                        isNew={false}
                        onSave={saveMilestone}
                        onCancel={() => setEditingMilestoneId(null)}
                        saving={saving}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>{m.percent}%</td>
                    <td>{describeRule(m.ruleJson)}</td>
                    <td>
                      {canManage && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn secondary" onClick={() => startEditMilestone(m)}>Edit</button>
                          <button className="btn secondary" onClick={() => deleteMilestone(m.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              ))}
              {editingMilestoneId === '__new__' && (
                <tr>
                  <td colSpan={4}>
                    <MilestoneForm
                      draft={milestoneDraft}
                      setDraft={setMilestoneDraft}
                      stageTemplates={stageTemplates}
                      milestones={milestones}
                      isNew
                      onSave={saveMilestone}
                      onCancel={() => setEditingMilestoneId(null)}
                      saving={saving}
                    />
                  </td>
                </tr>
              )}
              {milestones.length === 0 && editingMilestoneId !== '__new__' && (
                <tr><td colSpan={4} className="muted">No payment milestones configured for this client.</td></tr>
              )}
            </tbody>
          </table>
          {canManage && editingMilestoneId === null && (
            <button className="btn" style={{ marginTop: 12 }} onClick={startAddMilestone}>Add milestone</button>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Configuration</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Defaults for every project of this client. A project can override any of these individually.
          </p>
          <ConfigEditor configs={configs} canManage={canManage} onSave={saveConfig} onClear={clearConfig} />
        </div>
      </div>
    </>
  );
}
