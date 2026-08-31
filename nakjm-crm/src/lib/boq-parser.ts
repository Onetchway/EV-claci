import * as XLSX from "xlsx";

import type { BoqCategory } from "./constants";
import type { BoqLineItem } from "./types";

const HEADER_PATTERNS: Record<string, RegExp> = {
  srNo: /^(sr\.?\s*no\.?|s\.?\s*no\.?|#)$/i,
  description: /description|particular|item.*work|scope/i,
  makeOem: /make|oem|brand/i,
  unit: /^unit$/i,
  qty: /qty|quantity/i,
  supplyRate: /supply.*(rate|charge)/i,
  installationRate: /install.*(rate|charge)/i,
  unitRate: /^(unit\s*)?rate/i,
  amount: /amount|total/i,
  category: /category/i,
  remarks: /remark/i,
};

const CATEGORY_VALUES: BoqCategory[] = ["HT", "LT", "CIVIL", "MEP", "CHARGER", "OTHER"];

/** A repeated column-header row, or a "Subtotal"/"Total" rollup row -- never a real line item. */
const SKIP_ROW_PATTERN = /^(sub\s*)?total\b|^grand\s*total\b|^description$/i;

const normalize = (v: unknown): string => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function detectHeaderRow(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const cells = (rows[r] ?? []).map(normalize);
    const hasDescription = cells.some((c) => HEADER_PATTERNS.description!.test(c));
    const hasQtyOrAmount = cells.some((c) => HEADER_PATTERNS.qty!.test(c) || HEADER_PATTERNS.amount!.test(c));
    if (hasDescription && hasQtyOrAmount) return r;
  }
  return -1;
}

function mapColumns(headerRow: unknown[]): Partial<Record<keyof typeof HEADER_PATTERNS, number>> {
  const map: Partial<Record<string, number>> = {};
  headerRow.forEach((cell, idx) => {
    const text = normalize(cell);
    if (!text) return;
    for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (map[key] === undefined && pattern.test(text)) { map[key] = idx; break; }
    }
  });
  return map;
}

/** Parses a BOQ-style spreadsheet (NAKJM's standard formats) into line items, in the browser. */
export async function parseBoqFile(file: File): Promise<BoqLineItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const items: BoqLineItem[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const headerIdx = detectHeaderRow(rows);
    if (headerIdx === -1) continue;

    const cols = mapColumns(rows[headerIdx]!);
    if (cols.description === undefined) continue;

    let currentSection: string | undefined;
    let autoSr = 1;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const description = normalize(row[cols.description]);
      if (!description) {
        // A section label sometimes sits outside the mapped Description column (merged cells
        // commonly land in column A while items start in column B) -- capture the row's first
        // non-blank cell as the section name instead of silently dropping it.
        const firstCell = row.find((v) => normalize(v));
        if (firstCell !== undefined) {
          const label = normalize(firstCell);
          if (!SKIP_ROW_PATTERN.test(label)) currentSection = label;
        }
        continue;
      }

      // A repeated header row (same sheet, later section) or a "Subtotal"/"Total" rollup row is
      // neither a real item nor a section label -- skip it outright so it doesn't double-count
      // a section's total or overwrite the current section name with the word "Description".
      if (SKIP_ROW_PATTERN.test(description)) continue;

      const srNoCell = cols.srNo !== undefined ? row[cols.srNo] : undefined;
      const hasSrNo = srNoCell !== null && srNoCell !== undefined && srNoCell !== "" && toNumber(srNoCell) > 0;

      const qty = cols.qty !== undefined ? toNumber(row[cols.qty]) : 0;
      const amount = cols.amount !== undefined ? toNumber(row[cols.amount]) : 0;
      const supplyRate = cols.supplyRate !== undefined ? toNumber(row[cols.supplyRate]) : 0;
      const installationRate = cols.installationRate !== undefined ? toNumber(row[cols.installationRate]) : 0;
      const unitRate = cols.unitRate !== undefined ? toNumber(row[cols.unitRate]) : 0;

      // A numbered row is a real line item even with blank qty/rate (rates not finalized yet) --
      // only an un-numbered, all-blank row is actually a section label.
      const hasNumbers = qty || amount || supplyRate || installationRate || unitRate;
      if (!hasNumbers && !hasSrNo) { currentSection = description; continue; }

      const rawCategory = cols.category !== undefined ? normalize(row[cols.category]).toUpperCase() : "";
      const category = (CATEGORY_VALUES as string[]).includes(rawCategory) ? (rawCategory as BoqCategory) : "OTHER";

      items.push({
        section: currentSection,
        srNo: cols.srNo !== undefined && row[cols.srNo] ? toNumber(row[cols.srNo]) : autoSr++,
        description,
        makeOem: cols.makeOem !== undefined ? normalize(row[cols.makeOem]) || undefined : undefined,
        unit: cols.unit !== undefined ? normalize(row[cols.unit]) || undefined : undefined,
        qty,
        rate: unitRate || supplyRate + installationRate || (qty ? amount / qty : 0),
        amount,
        supplyRate,
        installationRate,
        category,
        remarks: cols.remarks !== undefined ? normalize(row[cols.remarks]) || undefined : undefined,
      });
    }
  }

  return items;
}
