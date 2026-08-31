import * as XLSX from "xlsx";

import type { DraftItem } from "@/components/line-items-table";
import { extractPdfRows } from "./pdf-table-extract";

const HEADER_PATTERNS: Record<string, RegExp> = {
  srNo: /^(sr\.?\s*no\.?|s\.?\s*no\.?|#)$/i,
  description: /description|particular|item.*work|scope/i,
  hsnCode: /hsn|sac/i,
  unit: /^unit$/i,
  qty: /qty|quantity/i,
  rate: /rate|price/i,
  gstPercent: /gst\s*%|gst\s*rate|tax\s*%/i,
  amount: /amount|total/i,
};

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

/** Shared by the Excel and PDF import paths -- both reduce to the same unknown[][] row shape. */
function extractItemsFromRows(rows: unknown[][]): DraftItem[] {
  const items: DraftItem[] = [];
  const headerIdx = detectHeaderRow(rows);
  if (headerIdx === -1) return items;

  const cols = mapColumns(rows[headerIdx]!);
  if (cols.description === undefined) return items;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const description = normalize(row[cols.description]);
    if (!description) continue;
    if (SKIP_ROW_PATTERN.test(description)) continue;

    const srNoCell = cols.srNo !== undefined ? row[cols.srNo] : undefined;
    const hasSrNo = srNoCell !== null && srNoCell !== undefined && srNoCell !== "" && toNumber(srNoCell) > 0;

    const qty = cols.qty !== undefined ? toNumber(row[cols.qty]) : 0;
    const amount = cols.amount !== undefined ? toNumber(row[cols.amount]) : 0;
    const rate = cols.rate !== undefined ? toNumber(row[cols.rate]) : (qty ? amount / qty : 0);
    if (!qty && !amount && !rate && !hasSrNo) continue;

    items.push({
      description,
      unit: cols.unit !== undefined ? normalize(row[cols.unit]) || undefined : undefined,
      qty,
      rate,
      hsnCode: cols.hsnCode !== undefined ? normalize(row[cols.hsnCode]) || undefined : undefined,
      gstPercent: cols.gstPercent !== undefined && row[cols.gstPercent] ? toNumber(row[cols.gstPercent]) : undefined,
    });
  }
  return items;
}

/**
 * Parses a Quotation/PO-style spreadsheet or text-based PDF (Description/
 * Unit/Qty/Rate[/HSN/GST%]) into line items, in the browser. A scanned/image
 * PDF has no text layer to extract and yields no rows -- the caller should
 * report that as "couldn't detect a line-item table" like any other miss.
 */
export async function parseLineItemFile(file: File): Promise<DraftItem[]> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const rows = await extractPdfRows(file);
    return extractItemsFromRows(rows);
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const items: DraftItem[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    items.push(...extractItemsFromRows(rows));
  }
  return items;
}
