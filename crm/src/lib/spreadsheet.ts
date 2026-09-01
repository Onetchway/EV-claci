"use client";

/**
 * Spreadsheet import and export.
 *
 * ExcelJS is loaded with a dynamic import so the ~800 KB library only reaches
 * the browser when somebody actually clicks import or export — it stays out of
 * the bundle every other page loads.
 *
 * CSV is handled by hand rather than by a parser: the files that matter here
 * are exports from this app, from Excel, or from a bank/portal, and a small
 * RFC-4180 reader covers those without another dependency.
 */

export interface Column<T> {
  /** Header text written to the sheet and matched on import. */
  header: string;
  /** Value for export. */
  value: (row: T) => string | number | null | undefined;
  width?: number;
  /** Alternative headers accepted on import, lowercased. */
  aliases?: string[];
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv<T>(filename: string, columns: Column<T>[], rows: T[]) {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(",")),
  ];
  // The BOM makes Excel open UTF-8 correctly on Windows — without it, ₹ and
  // Indian names in the export come out mangled.
  download(new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" }), filename);
}

export async function exportXlsx<T>(
  filename: string,
  sheets: { name: string; columns: Column<T>[]; rows: T[] }[],
) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Livanto Green CRM";
  wb.created = new Date();

  for (const sheet of sheets) {
    // Excel rejects these characters in a sheet name, and caps it at 31 chars.
    const ws = wb.addWorksheet(sheet.name.replace(/[*?:\\/[\]]/g, "-").slice(0, 31));
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.header,
      width: c.width ?? Math.min(38, Math.max(12, c.header.length + 4)),
    }));

    for (const row of sheet.rows) {
      ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.header, c.value(row) ?? ""])));
    }

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F9252" } };
    head.alignment = { vertical: "middle" };
    head.height = 20;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(1, sheet.columns.length) },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
}

/** Minimal RFC-4180 reader — handles quoted fields, embedded commas and CRLF. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function toSheetData(matrix: string[][]): SheetData {
  const [headerRow = [], ...body] = matrix;
  const headers = headerRow.map((h) => h.trim());
  const rows = body.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").toString().trim()])),
  );
  return { headers, rows };
}

/** Reads the first sheet of an .xlsx/.xls, or a .csv, into rows keyed by header. */
export async function readSpreadsheet(file: File): Promise<SheetData> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (isCsv) return toSheetData(parseCsv(await file.text()));

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("That workbook has no sheets.");

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // ExcelJS rows are 1-indexed and pad index 0, so drop the first slot.
    matrix.push(values.slice(1).map((v) => cellToString(v)));
  });
  return toSheetData(matrix);
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; hyperlink?: string; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    if (o.hyperlink) return o.hyperlink;
    return "";
  }
  return String(v);
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Matches a spreadsheet's headers to our columns, ignoring case, spacing and
 * punctuation, so "Phone Number", "phone_number" and "PHONE NO." all land on
 * the same field.
 */
export function mapHeaders<T>(
  headers: string[],
  columns: Column<T>[],
): Record<string, string | null> {
  const byNormal = new Map<string, string>();
  for (const h of headers) byNormal.set(normalise(h), h);

  const mapping: Record<string, string | null> = {};
  for (const col of columns) {
    const candidates = [col.header, ...(col.aliases ?? [])];
    const hit = candidates.map(normalise).find((c) => byNormal.has(c));
    mapping[col.header] = hit ? byNormal.get(hit)! : null;
  }
  return mapping;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportResult<T> {
  valid: T[];
  issues: ImportIssue[];
  skipped: number;
}

/**
 * Runs each spreadsheet row through a builder that either returns a record or
 * an error message. Nothing is written to the database here — the caller shows
 * a preview first, because a bad import is far more painful to undo than to
 * prevent.
 */
export function buildRows<T>(
  data: SheetData,
  mapping: Record<string, string | null>,
  build: (get: (column: string) => string, rowNumber: number) => T | string,
): ImportResult<T> {
  const valid: T[] = [];
  const issues: ImportIssue[] = [];
  let skipped = 0;

  data.rows.forEach((raw, i) => {
    const rowNumber = i + 2; // +1 for the header, +1 for 1-based numbering
    const get = (column: string) => {
      const source = mapping[column];
      return source ? (raw[source] ?? "").trim() : "";
    };

    if (Object.values(raw).every((v) => !v)) { skipped += 1; return; }

    const result = build(get, rowNumber);
    if (typeof result === "string") issues.push({ row: rowNumber, message: result });
    else valid.push(result);
  });

  return { valid, issues, skipped };
}

/** A header-only file the user can fill in and import back. */
export function downloadTemplate<T>(filename: string, columns: Column<T>[], sample?: T) {
  exportCsv(filename, columns, sample ? [sample] : []);
}

/** Accepts 21/07/2026, 2026-07-21, 21-07-2026 and Excel's own serial numbers. */
export function parseSheetDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = Number(yy!.length === 2 ? `20${yy}` : yy);
    const d = new Date(year, Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Excel serial: days since 1899-12-30.
  if (/^\d{5}$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86_400_000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(v);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Strips ₹, commas and spaces: "₹15,50,000" → 1550000. */
export function parseSheetNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
