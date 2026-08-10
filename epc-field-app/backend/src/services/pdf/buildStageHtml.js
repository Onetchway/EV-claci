/**
 * Renders a stage Submission generically from its StageTemplate's FormFieldDef/PhotoSlot
 * definitions — this is what makes one PDF template work for every V-Green stage (and any
 * future client's stages) without per-stage hand-written HTML.
 *
 * Table field convention: optionsJson = { rows: string[], columns: {key,label}[] }
 * and dataJson[field.key] = { [rowLabel]: { [columnKey]: value } }.
 * Select field convention: optionsJson = { options: string[] }.
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSimpleField(field, value) {
  let displayValue;
  if (field.type === 'checkbox') {
    displayValue = value ? '✔ Yes' : '✘ No';
  } else if (field.type === 'file') {
    displayValue = value ? 'Attached' : 'Not attached';
  } else if (value === undefined || value === null || value === '') {
    displayValue = '—';
  } else {
    displayValue = value;
  }
  return `
    <div class="field-row">
      <div class="field-label">${escapeHtml(field.label)}${field.required ? ' *' : ''}</div>
      <div class="field-value">${escapeHtml(displayValue)}</div>
    </div>`;
}

function renderTableField(field, value) {
  const rows = field.optionsJson?.rows || [];
  const columns = field.optionsJson?.columns || [{ key: 'value', label: 'Value' }];
  const body = rows
    .map((rowLabel) => {
      const rowData = value?.[rowLabel] || {};
      const cells = columns
        .map((col) => `<td>${escapeHtml(rowData[col.key])}</td>`)
        .join('');
      return `<tr><td class="row-label">${escapeHtml(rowLabel)}</td>${cells}</tr>`;
    })
    .join('');
  const headerCells = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  return `
    <div class="table-field">
      <div class="field-label">${escapeHtml(field.label)}</div>
      <table class="data-table">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function groupFields(fieldDefs) {
  const groups = [];
  const byLabel = new Map();
  for (const field of fieldDefs) {
    const key = field.groupLabel || '';
    if (!byLabel.has(key)) {
      const group = { label: field.groupLabel || null, fields: [] };
      byLabel.set(key, group);
      groups.push(group);
    }
    byLabel.get(key).fields.push(field);
  }
  return groups;
}

function renderPhotoGrid(photoSlots, photos) {
  const photoBySlotId = new Map(photos.map((p) => [p.photoSlotId, p]));
  const cells = photoSlots
    .map((slot) => {
      const photo = photoBySlotId.get(slot.id);
      const img = photo
        ? `<img src="${photo.stampedFileUrl}" />`
        : `<div class="missing-photo">Not submitted${slot.required ? ' (required)' : ''}</div>`;
      const meta = photo
        ? `<div class="photo-meta">${escapeHtml(photo.address || '')}<br/>Lat ${photo.lat.toFixed(5)}, Lng ${photo.lng.toFixed(5)} · ${new Date(photo.capturedAt).toLocaleString('en-IN')}</div>`
        : '';
      return `
        <div class="photo-cell">
          ${img}
          <div class="photo-label">${escapeHtml(slot.label)}</div>
          ${meta}
        </div>`;
    })
    .join('');
  return `<div class="photo-grid">${cells}</div>`;
}

function buildStageHtml({ client, project, stageTemplate, submission, photos, photoFileUrls, footerText }) {
  const fieldDefs = [...stageTemplate.fieldDefs].sort((a, b) => a.order - b.order);
  const photoSlots = [...stageTemplate.photoSlots].sort((a, b) => a.order - b.order);
  const data = submission.dataJson || {};

  const photosWithUrls = photos.map((p) => ({
    ...p,
    stampedFileUrl: photoFileUrls.get(p.id),
  }));

  const groups = groupFields(fieldDefs);
  const fieldsHtml = groups
    .map((group) => {
      const rows = group.fields
        .filter((f) => f.type !== 'photo')
        .map((f) => (f.type === 'table' ? renderTableField(f, data[f.key]) : renderSimpleField(f, data[f.key])))
        .join('');
      const heading = group.label ? `<h3 class="group-heading">${escapeHtml(group.label)}</h3>` : '';
      return `<section class="field-group">${heading}${rows}</section>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0b6e4f; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { font-size: 18px; margin: 0 0 4px 0; color: #0b6e4f; }
  .header .subtitle { font-size: 12px; color: #444; }
  .header .meta { text-align: right; font-size: 11px; color: #444; }
  .field-group { margin-bottom: 16px; }
  .group-heading { font-size: 13px; background: #eef7f2; padding: 6px 10px; border-left: 4px solid #0b6e4f; margin: 0 0 8px 0; }
  .field-row { display: flex; border-bottom: 1px solid #eee; padding: 4px 2px; }
  .field-label { width: 45%; font-weight: 600; color: #333; }
  .field-value { width: 55%; }
  .table-field { margin: 8px 0 14px 0; }
  .data-table { border-collapse: collapse; width: 100%; margin-top: 4px; }
  .data-table th, .data-table td { border: 1px solid #ccc; padding: 5px 8px; font-size: 11px; text-align: left; }
  .data-table th { background: #f4f4f4; }
  .row-label { font-weight: 600; background: #fafafa; }
  .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
  .photo-cell { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .photo-cell img { width: 100%; height: 180px; object-fit: cover; display: block; }
  .missing-photo { width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: #fbeaea; color: #a33; font-size: 11px; text-align: center; padding: 8px; }
  .photo-label { font-weight: 600; padding: 6px 8px 2px 8px; font-size: 11px; }
  .photo-meta { padding: 0 8px 8px 8px; font-size: 10px; color: #666; }
  .footer { margin-top: 24px; font-size: 9px; color: #888; text-align: center; }
  h2.section-title { font-size: 14px; color: #0b6e4f; border-bottom: 1px solid #ccd; padding-bottom: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(client.name)} — ${escapeHtml(stageTemplate.name)} Report</h1>
      <div class="subtitle">${escapeHtml(project.siteName)} — ${escapeHtml(project.address)}</div>
    </div>
    <div class="meta">
      Submission v${submission.version}<br/>
      Submitted: ${submission.createdAt ? new Date(submission.createdAt).toLocaleString('en-IN') : '—'}
    </div>
  </div>

  <h2 class="section-title">Report Data</h2>
  ${fieldsHtml}

  ${photoSlots.length ? '<h2 class="section-title">Geotagged Photos</h2>' + renderPhotoGrid(photoSlots, photosWithUrls) : ''}

  <div class="footer">${escapeHtml(footerText)}</div>
</body>
</html>`;
}

module.exports = { buildStageHtml };
