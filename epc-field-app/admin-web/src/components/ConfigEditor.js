'use client';

import { useState } from 'react';

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseInputValue(valueType, raw) {
  if (valueType === 'NUMBER') {
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error('Must be a number');
    return n;
  }
  if (valueType === 'BOOLEAN') return raw === 'true';
  if (valueType === 'JSON') return JSON.parse(raw);
  return raw;
}

/**
 * Renders a resolved config list (from GET /clients/:id/config or /projects/:id/config)
 * generically — new config keys need no changes here, just an entry in configDefs.js.
 */
export default function ConfigEditor({ configs, canManage, onSave, onClear, inheritedLabel }) {
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(cfg) {
    setEditingKey(cfg.key);
    const current = cfg.overrideValue !== null && cfg.overrideValue !== undefined ? cfg.overrideValue : cfg.effectiveValue;
    setDraft(formatValue(current));
    setError('');
  }

  async function save(cfg) {
    setSaving(true);
    setError('');
    try {
      const value = parseInputValue(cfg.valueType, draft);
      await onSave(cfg.key, value);
      setEditingKey(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function clear(cfg) {
    setSaving(true);
    setError('');
    try {
      await onClear(cfg.key);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasOverride = (cfg) => cfg.overrideValue !== null && cfg.overrideValue !== undefined;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <table>
        <thead>
          <tr><th>Setting</th><th>Value</th><th></th></tr>
        </thead>
        <tbody>
          {configs.map((cfg) => (
            <tr key={cfg.key}>
              <td>
                <div style={{ fontWeight: 600 }}>{cfg.label}</div>
                <div className="muted" style={{ fontSize: 12 }}>{cfg.description}</div>
                {inheritedLabel && 'clientValue' in cfg && (
                  <div className="muted" style={{ fontSize: 11 }}>{inheritedLabel}: {formatValue(cfg.clientValue)}</div>
                )}
              </td>
              <td>
                {editingKey === cfg.key ? (
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: '100%' }} />
                ) : (
                  <span>
                    {formatValue(cfg.effectiveValue)}
                    {hasOverride(cfg) && <span className="muted"> (override)</span>}
                  </span>
                )}
              </td>
              <td>
                {!canManage ? null : editingKey === cfg.key ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" disabled={saving} onClick={() => save(cfg)}>Save</button>
                    <button className="btn secondary" disabled={saving} onClick={() => setEditingKey(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary" onClick={() => startEdit(cfg)}>Edit</button>
                    {hasOverride(cfg) && (
                      <button className="btn secondary" disabled={saving} onClick={() => clear(cfg)}>Reset</button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {configs.length === 0 && (
            <tr><td colSpan={3} className="muted">No configurable settings.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
