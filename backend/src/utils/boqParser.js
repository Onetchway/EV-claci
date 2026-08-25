'use strict';

const XLSX = require('xlsx');

const HEADER_PATTERNS = {
  sr_no: /^(sr\.?\s*no\.?|s\.?\s*no\.?|#)$/i,
  description: /description|particular|item.*work|scope/i,
  make_oem: /make|oem|brand/i,
  unit: /^unit$/i,
  qty: /qty|quantity/i,
  supply_rate: /supply.*(rate|charge)/i,
  installation_rate: /install.*(rate|charge)/i,
  unit_rate: /^(unit\s*)?rate/i,
  amount: /amount|total/i,
  category: /category/i,
  remarks: /remark/i,
};

const normalize = (v) => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim();

const detectHeaderRow = (rows) => {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    const cells = row.map(normalize);
    const hasDescription = cells.some(c => HEADER_PATTERNS.description.test(c));
    const hasQtyOrAmount = cells.some(c => HEADER_PATTERNS.qty.test(c) || HEADER_PATTERNS.amount.test(c));
    if (hasDescription && hasQtyOrAmount) return r;
  }
  return -1;
};

const mapColumns = (headerRow) => {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const text = normalize(cell);
    if (!text) return;
    for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (map[key] === undefined && pattern.test(text)) { map[key] = idx; break; }
    }
  });
  return map;
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const CATEGORY_VALUES = new Set(['ht', 'lt', 'civil', 'mep', 'charger', 'other']);

/**
 * Parses a BOQ-style Excel workbook (as produced by NAKJM's standard formats)
 * into a flat list of BOQ line items, grouped by section.
 */
const parseBoqWorkbook = (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const items = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const headerIdx = detectHeaderRow(rows);
    if (headerIdx === -1) continue;

    const cols = mapColumns(rows[headerIdx]);
    if (cols.description === undefined) continue;

    let currentSection = null;
    let autoSr = 1;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const description = normalize(row[cols.description]);
      if (!description) continue;

      const qty = cols.qty !== undefined ? toNumber(row[cols.qty]) : 0;
      const amount = cols.amount !== undefined ? toNumber(row[cols.amount]) : 0;
      const supplyRate = cols.supply_rate !== undefined ? toNumber(row[cols.supply_rate]) : 0;
      const installRate = cols.installation_rate !== undefined ? toNumber(row[cols.installation_rate]) : 0;
      const unitRate = cols.unit_rate !== undefined ? toNumber(row[cols.unit_rate]) : 0;

      // A row with a description but no numeric data at all is a section header, not a line item.
      const hasNumbers = qty || amount || supplyRate || installRate || unitRate;
      if (!hasNumbers) { currentSection = description; continue; }

      const category = cols.category !== undefined
        ? (CATEGORY_VALUES.has(normalize(row[cols.category]).toLowerCase()) ? normalize(row[cols.category]).toLowerCase() : 'other')
        : 'other';

      items.push({
        section: currentSection,
        sr_no: cols.sr_no !== undefined && row[cols.sr_no] ? toNumber(row[cols.sr_no]) : autoSr++,
        description,
        make_oem: cols.make_oem !== undefined ? normalize(row[cols.make_oem]) || null : null,
        unit: cols.unit !== undefined ? normalize(row[cols.unit]) || null : null,
        qty,
        supply_rate: supplyRate,
        installation_rate: installRate,
        unit_rate: unitRate || (supplyRate + installRate) || (qty ? amount / qty : 0),
        category,
        remarks: cols.remarks !== undefined ? normalize(row[cols.remarks]) || null : null,
      });
    }
  }

  return items;
};

module.exports = { parseBoqWorkbook };
