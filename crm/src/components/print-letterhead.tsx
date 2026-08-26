"use client";

import type { ReactNode } from "react";

import { SimpleDocumentFooter, SimpleDocumentHeader, type Company } from "@/components/simple-document";
import { cn } from "@/lib/utils";

/**
 * The Letter of Intent / EOI is the one document long enough to routinely
 * span multiple printed pages, so it needs its header/footer to actually
 * repeat at the same position on every page — a <table> with
 * <thead>/<tfoot> does that: unlike `position: fixed`, table head/foot rows
 * are real layout the browser reserves space for on each page, so body
 * content can never print underneath them. See globals.css's
 * `.loi-print-table` rules. The header/footer content itself is the same
 * plain company-letterhead design every other printed document (PO, PI,
 * Quotation, Tax Invoice) uses — see simple-document.tsx — just repeated
 * through this table wrapper instead of printed once.
 */

export function PrintDocument({ header, footer, children, className }: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("loi-print-table", className)}>
      <thead>
        <tr><td className="loi-print-header-cell">{header}</td></tr>
      </thead>
      <tbody>
        <tr><td className="loi-print-body-cell">{children}</td></tr>
      </tbody>
      <tfoot>
        <tr><td className="loi-print-footer-cell">{footer}</td></tr>
      </tfoot>
    </table>
  );
}

export function PrintHeader({ company, docLabel, docNumber, meta }: {
  company: Company;
  docLabel: string;
  docNumber: string;
  meta?: ReactNode;
}) {
  return (
    <div className="loi-print-header">
      <SimpleDocumentHeader company={company} docLabel={docLabel} docNumber={docNumber} meta={meta} />
    </div>
  );
}

export function PrintFooter({ company }: { company: Company }) {
  return (
    <div className="loi-print-footer">
      <SimpleDocumentFooter company={company} />
    </div>
  );
}
