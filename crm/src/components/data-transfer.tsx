"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Badge, Button, Modal, useToast } from "@/components/ui";
import {
  buildRows, downloadTemplate, exportCsv, exportXlsx, mapHeaders, readSpreadsheet,
  type Column, type ImportIssue, type SheetData,
} from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";

/** Export menu — CSV for quick use, XLSX for a formatted, filterable workbook. */
export function ExportButton<T>({
  filename, columns, rows, label = "Export", disabled, sheetName = "Data",
}: {
  filename: string;
  columns: Column<T>[];
  rows: T[];
  label?: string;
  disabled?: boolean;
  sheetName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const stamp = new Date().toISOString().slice(0, 10);

  async function run(kind: "csv" | "xlsx") {
    setBusy(true);
    try {
      if (kind === "csv") exportCsv(`${filename}-${stamp}.csv`, columns, rows);
      else await exportXlsx(`${filename}-${stamp}.xlsx`, [{ name: sheetName, columns, rows }]);
      push(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}.`, "success");
      setOpen(false);
    } catch (e) {
      push((e as Error).message || "Export failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled || rows.length === 0}>
        <Download className="h-4 w-4" /> {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export data"
        description={`${rows.length} row${rows.length === 1 ? "" : "s"} matching your current filters.`}
        footer={<Button onClick={() => setOpen(false)}>Cancel</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("xlsx")}
            className="rounded-lg border border-ink-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-ink-900">Excel (.xlsx)</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Formatted headers, frozen top row and filters already switched on.
            </p>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void run("csv")}
            className="rounded-lg border border-ink-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
          >
            <Download className="h-5 w-5 text-sky-600" />
            <p className="mt-2 text-sm font-semibold text-ink-900">CSV (.csv)</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Opens anywhere — Excel, Google Sheets, Tally, any other system.
            </p>
          </button>
        </div>
      </Modal>
    </>
  );
}

export interface ImportPreview<T> {
  valid: T[];
  issues: ImportIssue[];
  skipped: number;
}

/**
 * Import with a mandatory preview.
 *
 * Nothing is written until the user has seen the row count and every rejected
 * row with its reason. A bad bulk import is far more painful to unpick than to
 * prevent, so the preview is not optional.
 *
 * `TRow` is what each spreadsheet line becomes (a draft ready to save); `TCol`
 * is whatever the column definitions describe. They are separate because the
 * import columns are reused from the export definitions, which are typed
 * against the stored record rather than the draft.
 */
export function ImportButton<TRow, TCol>({
  title, columns, buildRow, onCommit, templateName, label = "Import", disabled,
}: {
  title: string;
  columns: Column<TCol>[];
  buildRow: (get: (column: string) => string, rowNumber: number) => TRow | string;
  onCommit: (rows: TRow[], onProgress: (done: number) => void) => Promise<void>;
  templateName: string;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SheetData | null>(null);
  const [preview, setPreview] = useState<ImportPreview<TRow> | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  function reset() {
    setData(null);
    setPreview(null);
    setMapping({});
    setProgress(null);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const sheet = await readSpreadsheet(file);
      if (!sheet.rows.length) throw new Error("That file has no data rows.");
      const map = mapHeaders(sheet.headers, columns);
      setData(sheet);
      setMapping(map);
      setPreview(buildRows(sheet, map, buildRow));
    } catch (e) {
      push((e as Error).message || "Could not read that file.", "error");
    } finally {
      setBusy(false);
    }
  }

  function remap(column: string, source: string | null) {
    if (!data) return;
    const next = { ...mapping, [column]: source };
    setMapping(next);
    setPreview(buildRows(data, next, buildRow));
  }

  async function commit() {
    if (!preview?.valid.length) return;
    setBusy(true);
    setProgress(0);
    try {
      await onCommit(preview.valid, setProgress);
      push(`Imported ${preview.valid.length} row${preview.valid.length === 1 ? "" : "s"}.`, "success");
      setOpen(false);
      reset();
    } catch (e) {
      push((e as Error).message || "Import failed.", "error");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const unmapped = columns.filter((c) => !mapping[c.header]);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        <Upload className="h-4 w-4" /> {label}
      </Button>

      <Modal
        open={open}
        onClose={() => { if (!busy) { setOpen(false); reset(); } }}
        title={title}
        description="Excel or CSV. You will see exactly what will be created before anything is saved."
        wide
        footer={
          <>
            <Button onClick={() => { setOpen(false); reset(); }} disabled={busy}>Cancel</Button>
            {preview && (
              <Button
                variant="primary"
                loading={busy}
                disabled={!preview.valid.length}
                onClick={() => void commit()}
              >
                Import {preview.valid.length} row{preview.valid.length === 1 ? "" : "s"}
              </Button>
            )}
          </>
        }
      >
        {!data ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void onFile(e.dataTransfer.files?.[0] ?? null); }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition",
                dragOver ? "border-brand-500 bg-brand-50" : "border-ink-300 hover:border-ink-400",
              )}
            >
              <FileSpreadsheet className="mx-auto h-7 w-7 text-ink-400" />
              <p className="mt-2 text-sm font-medium text-ink-800">
                Drop an .xlsx or .csv here, or click to browse
              </p>
              <p className="mt-0.5 text-xs text-ink-500">The first row must be the column headers.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="rounded-lg bg-ink-50 px-4 py-3">
              <p className="text-sm font-medium text-ink-800">Not sure of the format?</p>
              <p className="mt-0.5 text-xs text-ink-500">
                Download a template with the exact headers, fill it in, and import it back.
              </p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => downloadTemplate(`${templateName}-template.csv`, columns)}
              >
                <Download className="h-3.5 w-3.5" /> Download template
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">
                {preview?.valid.length ?? 0} ready
              </Badge>
              {(preview?.issues.length ?? 0) > 0 && (
                <Badge className="bg-rose-100 text-rose-800 ring-rose-200">
                  {preview!.issues.length} rejected
                </Badge>
              )}
              {(preview?.skipped ?? 0) > 0 && (
                <Badge>{preview!.skipped} blank rows skipped</Badge>
              )}
            </div>

            <div>
              <p className="label">Column mapping</p>
              <p className="mb-2 text-xs text-ink-500">
                Matched automatically by name. Correct anything that landed in the wrong place.
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2 scroll-thin">
                {columns.map((c) => (
                  <div key={c.header} className="grid grid-cols-2 items-center gap-2">
                    <span className="truncate text-xs font-medium text-ink-700">{c.header}</span>
                    <select
                      value={mapping[c.header] ?? ""}
                      onChange={(e) => remap(c.header, e.target.value || null)}
                      className="input py-1 text-xs"
                    >
                      <option value="">— not mapped —</option>
                      {data.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {unmapped.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-700">
                  {unmapped.length} column{unmapped.length === 1 ? "" : "s"} not found in your file —
                  those fields will be left empty.
                </p>
              )}
            </div>

            {preview && preview.issues.length > 0 && (
              <div>
                <p className="label">Rows that will be skipped</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-900 scroll-thin">
                  {preview.issues.slice(0, 50).map((i) => (
                    <li key={i.row}>
                      <strong>Row {i.row}:</strong> {i.message}
                    </li>
                  ))}
                  {preview.issues.length > 50 && (
                    <li className="italic">…and {preview.issues.length - 50} more.</li>
                  )}
                </ul>
              </div>
            )}

            {progress !== null && (
              <p className="text-sm text-ink-600">
                Saving… {progress} of {preview?.valid.length ?? 0}
              </p>
            )}

            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Choose a different file
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
