'use client';

const STATUS_OPTIONS = ['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'];

/** Structured editor for one PaymentMilestoneDef, supporting the two rule types the engine understands. */
export default function MilestoneForm({ draft, setDraft, stageTemplates, milestones, isNew, onSave, onCancel, saving }) {
  if (!draft) return null;

  function toggleSetField(field, value) {
    setDraft((prev) => {
      const next = new Set(prev[field]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [field]: next };
    });
  }

  return (
    <div className="grid cols-2" style={{ gap: 12 }}>
      {isNew && (
        <div className="field">
          <label>Key</label>
          <input value={draft.key} onChange={(e) => setDraft((p) => ({ ...p, key: e.target.value }))} placeholder="e.g. CIVIL_COMPLETION" />
        </div>
      )}
      <div className="field">
        <label>Label</label>
        <input value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} />
      </div>
      <div className="field">
        <label>Percent</label>
        <input type="number" value={draft.percent} onChange={(e) => setDraft((p) => ({ ...p, percent: e.target.value }))} />
      </div>
      <div className="field">
        <label>Order</label>
        <input type="number" value={draft.order} onChange={(e) => setDraft((p) => ({ ...p, order: e.target.value }))} />
      </div>
      <div className="field">
        <label>Rule type</label>
        <select value={draft.ruleType} onChange={(e) => setDraft((p) => ({ ...p, ruleType: e.target.value }))}>
          <option value="statusIn">All listed stages reach a status</option>
          <option value="daysAfterStageApproval">N days after a stage is approved</option>
        </select>
      </div>

      {draft.ruleType === 'statusIn' ? (
        <>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Stages that must all reach one of the statuses below</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {stageTemplates.map((st) => (
                <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'normal' }}>
                  <input type="checkbox" checked={draft.stageKeys.has(st.key)} onChange={() => toggleSetField('stageKeys', st.key)} />
                  {st.name}
                </label>
              ))}
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Any of these statuses counts as reached</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {STATUS_OPTIONS.map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'normal' }}>
                  <input type="checkbox" checked={draft.statuses.has(s)} onChange={() => toggleSetField('statuses', s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Stage</label>
            <select value={draft.daysStageKey} onChange={(e) => setDraft((p) => ({ ...p, daysStageKey: e.target.value }))}>
              <option value="">Select a stage…</option>
              {stageTemplates.map((st) => <option key={st.id} value={st.key}>{st.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Days after approval</label>
            <input type="number" value={draft.days} onChange={(e) => setDraft((p) => ({ ...p, days: e.target.value }))} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Also requires this milestone to already be achieved (optional)</label>
            <select value={draft.requiresMilestoneKey} onChange={(e) => setDraft((p) => ({ ...p, requiresMilestoneKey: e.target.value }))}>
              <option value="">None</option>
              {milestones.filter((m) => m.key !== draft.key).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
        <button className="btn" type="button" disabled={saving} onClick={onSave}>Save</button>
        <button className="btn secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
