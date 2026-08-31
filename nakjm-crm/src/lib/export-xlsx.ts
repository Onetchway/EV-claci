"use client";

import * as XLSX from "xlsx";

/** Exports rows of plain objects (keys become column headers) to a downloaded .xlsx file, entirely client-side. */
export function exportRowsToExcel(filename: string, sheetName: string, rows: Record<string, string | number>[]): void {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
