function displayValue(field, value) {
  if (field.type === 'checkbox') return value ? '✔ Yes' : '✘ No';
  if (field.type === 'file') return value ? 'Attached' : 'Not attached';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

function TableField({ field, value }) {
  const rows = field.optionsJson?.rows || [];
  const columns = field.optionsJson?.columns || [{ key: 'value', label: 'Value' }];
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{field.label}</div>
      <table>
        <thead>
          <tr><th></th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((rowLabel) => (
            <tr key={rowLabel}>
              <td style={{ fontWeight: 600 }}>{rowLabel}</td>
              {columns.map((c) => <td key={c.key}>{value?.[rowLabel]?.[c.key] || '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a stage's fieldDefs + a submission's dataJson generically, grouped by groupLabel. */
export default function SubmissionData({ fieldDefs, dataJson }) {
  const sorted = [...fieldDefs].sort((a, b) => a.order - b.order);
  const groups = [];
  const byLabel = new Map();
  for (const field of sorted) {
    const key = field.groupLabel || '';
    if (!byLabel.has(key)) {
      const group = { label: field.groupLabel || null, fields: [] };
      byLabel.set(key, group);
      groups.push(group);
    }
    byLabel.get(key).fields.push(field);
  }

  return (
    <div>
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 18 }}>
          {group.label && (
            <div style={{ background: '#eef7f2', padding: '5px 10px', fontSize: 12.5, fontWeight: 600, color: '#0b6e4f', marginBottom: 6, borderLeft: '3px solid #0b6e4f' }}>
              {group.label}
            </div>
          )}
          {group.fields.map((field) =>
            field.type === 'table' ? (
              <TableField key={field.key} field={field} value={dataJson?.[field.key]} />
            ) : (
              <div key={field.key} style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '5px 2px', fontSize: 13 }}>
                <div style={{ width: '48%', fontWeight: 600, color: '#333' }}>{field.label}{field.required ? ' *' : ''}</div>
                <div style={{ width: '52%' }}>{displayValue(field, dataJson?.[field.key])}</div>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
