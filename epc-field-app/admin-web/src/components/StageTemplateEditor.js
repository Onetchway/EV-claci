'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'file'];

function blankFieldDraft() {
  return { key: '', label: '', type: 'text', required: false, groupLabel: '', options: '' };
}

function blankSlotDraft() {
  return { key: '', label: '', required: true };
}

/**
 * Lets an admin build out a stage's report form (fields) and required photos entirely from the
 * dashboard — the same data that used to only be settable by editing prisma/seed.js and
 * redeploying. Renders inline wherever a stage row is expanded on the client detail page.
 */
export default function StageTemplateEditor({ clientId, stage, onChanged }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [addingField, setAddingField] = useState(false);
  const [fieldDraft, setFieldDraft] = useState(blankFieldDraft());
  const [editingFieldId, setEditingFieldId] = useState(null);

  const [addingSlot, setAddingSlot] = useState(false);
  const [slotDraft, setSlotDraft] = useState(blankSlotDraft());
  const [editingSlotId, setEditingSlotId] = useState(null);

  const base = `/clients/${clientId}/stage-templates/${stage.id}`;

  async function run(fn) {
    setSaving(true);
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function fieldPayload(draft) {
    const payload = {
      label: draft.label,
      required: draft.required,
      groupLabel: draft.groupLabel || null,
    };
    if (draft.type === 'select') {
      payload.optionsJson = { options: draft.options.split(',').map((o) => o.trim()).filter(Boolean) };
    }
    return payload;
  }

  async function createField() {
    await run(() =>
      apiFetch(`${base}/fields`, {
        method: 'POST',
        body: JSON.stringify({ key: fieldDraft.key, type: fieldDraft.type, ...fieldPayload(fieldDraft) }),
      }),
    );
    setAddingField(false);
    setFieldDraft(blankFieldDraft());
  }

  async function saveField(fieldId, draft) {
    await run(() => apiFetch(`${base}/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(fieldPayload(draft)) }));
    setEditingFieldId(null);
  }

  async function deleteField(fieldId) {
    await run(() => apiFetch(`${base}/fields/${fieldId}`, { method: 'DELETE' }));
  }

  async function createSlot() {
    await run(() => apiFetch(`${base}/photo-slots`, { method: 'POST', body: JSON.stringify(slotDraft) }));
    setAddingSlot(false);
    setSlotDraft(blankSlotDraft());
  }

  async function saveSlot(slotId, draft) {
    await run(() =>
      apiFetch(`${base}/photo-slots/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: draft.label, required: draft.required }),
      }),
    );
    setEditingSlotId(null);
  }

  async function deleteSlot(slotId) {
    await run(() => apiFetch(`${base}/photo-slots/${slotId}`, { method: 'DELETE' }));
  }

  return (
    <div style={{ padding: '10px 4px' }}>
      {error && <div className="error-box">{error}</div>}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Report fields</div>
        <table>
          <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th>Group</th><th></th></tr></thead>
          <tbody>
            {stage.fieldDefs.map((f) =>
              editingFieldId === f.id ? (
                <EditFieldRow key={f.id} field={f} onSave={(d) => saveField(f.id, d)} onCancel={() => setEditingFieldId(null)} saving={saving} />
              ) : (
                <tr key={f.id}>
                  <td>{f.label}</td>
                  <td className="muted">{f.key}</td>
                  <td>{f.type}</td>
                  <td>{f.required ? 'Yes' : 'No'}</td>
                  <td className="muted">{f.groupLabel || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn secondary" onClick={() => setEditingFieldId(f.id)}>Edit</button>
                      <button className="btn secondary" disabled={saving} onClick={() => deleteField(f.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {stage.fieldDefs.length === 0 && !addingField && (
              <tr><td colSpan={6} className="muted">No fields yet.</td></tr>
            )}
          </tbody>
        </table>

        {addingField ? (
          <div className="grid cols-2" style={{ marginTop: 10, gap: 10 }}>
            <div className="field">
              <label>Key (machine name, e.g. panelDatasheet)</label>
              <input value={fieldDraft.key} onChange={(e) => setFieldDraft((p) => ({ ...p, key: e.target.value }))} />
            </div>
            <div className="field">
              <label>Label</label>
              <input value={fieldDraft.label} onChange={(e) => setFieldDraft((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={fieldDraft.type} onChange={(e) => setFieldDraft((p) => ({ ...p, type: e.target.value }))}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Group heading (optional)</label>
              <input value={fieldDraft.groupLabel} onChange={(e) => setFieldDraft((p) => ({ ...p, groupLabel: e.target.value }))} />
            </div>
            {fieldDraft.type === 'select' && (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Options (comma-separated)</label>
                <input value={fieldDraft.options} onChange={(e) => setFieldDraft((p) => ({ ...p, options: e.target.value }))} />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
              <input type="checkbox" checked={fieldDraft.required} onChange={(e) => setFieldDraft((p) => ({ ...p, required: e.target.checked }))} />
              Required
            </label>
            <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
              <button className="btn" disabled={saving || !fieldDraft.key || !fieldDraft.label} onClick={createField}>Add field</button>
              <button className="btn secondary" disabled={saving} onClick={() => { setAddingField(false); setFieldDraft(blankFieldDraft()); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setAddingField(true)}>+ Add field</button>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Required photos</div>
        <table>
          <thead><tr><th>Label</th><th>Key</th><th>Required</th><th></th></tr></thead>
          <tbody>
            {stage.photoSlots.map((s) =>
              editingSlotId === s.id ? (
                <EditSlotRow key={s.id} slot={s} onSave={(d) => saveSlot(s.id, d)} onCancel={() => setEditingSlotId(null)} saving={saving} />
              ) : (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="muted">{s.key}</td>
                  <td>{s.required ? 'Yes' : 'No'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn secondary" onClick={() => setEditingSlotId(s.id)}>Edit</button>
                      <button className="btn secondary" disabled={saving} onClick={() => deleteSlot(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {stage.photoSlots.length === 0 && !addingSlot && (
              <tr><td colSpan={4} className="muted">No required photos yet.</td></tr>
            )}
          </tbody>
        </table>

        {addingSlot ? (
          <div className="grid cols-2" style={{ marginTop: 10, gap: 10 }}>
            <div className="field">
              <label>Key</label>
              <input value={slotDraft.key} onChange={(e) => setSlotDraft((p) => ({ ...p, key: e.target.value }))} />
            </div>
            <div className="field">
              <label>Label</label>
              <input value={slotDraft.label} onChange={(e) => setSlotDraft((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
              <input type="checkbox" checked={slotDraft.required} onChange={(e) => setSlotDraft((p) => ({ ...p, required: e.target.checked }))} />
              Required
            </label>
            <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
              <button className="btn" disabled={saving || !slotDraft.key || !slotDraft.label} onClick={createSlot}>Add photo</button>
              <button className="btn secondary" disabled={saving} onClick={() => { setAddingSlot(false); setSlotDraft(blankSlotDraft()); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setAddingSlot(true)}>+ Add required photo</button>
        )}
      </div>
    </div>
  );
}

function EditFieldRow({ field, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState({
    label: field.label,
    required: field.required,
    groupLabel: field.groupLabel || '',
    type: field.type,
    options: (field.optionsJson?.options || []).join(', '),
  });
  return (
    <tr>
      <td colSpan={6}>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="field">
            <label>Label</label>
            <input value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} />
          </div>
          <div className="field">
            <label>Group heading</label>
            <input value={draft.groupLabel} onChange={(e) => setDraft((p) => ({ ...p, groupLabel: e.target.value }))} />
          </div>
          {draft.type === 'select' && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Options (comma-separated)</label>
              <input value={draft.options} onChange={(e) => setDraft((p) => ({ ...p, options: e.target.value }))} />
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
            <input type="checkbox" checked={draft.required} onChange={(e) => setDraft((p) => ({ ...p, required: e.target.checked }))} />
            Required
          </label>
          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button className="btn" disabled={saving} onClick={() => onSave(draft)}>Save</button>
            <button className="btn secondary" disabled={saving} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditSlotRow({ slot, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState({ label: slot.label, required: slot.required });
  return (
    <tr>
      <td colSpan={4}>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="field">
            <label>Label</label>
            <input value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
            <input type="checkbox" checked={draft.required} onChange={(e) => setDraft((p) => ({ ...p, required: e.target.checked }))} />
            Required
          </label>
          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button className="btn" disabled={saving} onClick={() => onSave(draft)}>Save</button>
            <button className="btn secondary" disabled={saving} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  );
}
