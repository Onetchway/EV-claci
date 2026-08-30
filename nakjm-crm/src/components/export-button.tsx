"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui";
import { exportRowsToExcel } from "@/lib/export-xlsx";

export function ExportButton({
  filename, sheetName, rows, label = "Export",
}: {
  filename: string;
  sheetName: string;
  rows: Record<string, string | number>[];
  label?: string;
}) {
  return (
    <Button variant="secondary" onClick={() => exportRowsToExcel(filename, sheetName, rows)} disabled={rows.length === 0}>
      <Download className="h-4 w-4" /> {label}
    </Button>
  );
}
