"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared letterhead for every printed document except the Payment Receipt
 * (which is deliberately a bordered on-screen-style card, not a flat
 * letter). The header/footer are the brand's fixed banner artwork —
 * matching the reference letterhead exactly — with only the per-document
 * type/number line layered on top of the header.
 *
 * Repeats correctly on every printed page via a <table> with
 * <thead>/<tfoot>: unlike `position: fixed`, table head/foot rows are real
 * layout the browser reserves space for on each page, so body content can
 * never print underneath them. See globals.css's `.loi-print-table` rules.
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

export function PrintHeader({ docLabel, docNumber, meta }: {
  docLabel: string;
  docNumber: string;
  meta?: ReactNode;
}) {
  return (
    <div className="loi-print-header mb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/letterhead-header.png" alt="Livanto Green" className="block h-auto w-full" />
      <div className="mt-2 text-right">
        <p className="text-xs text-ink-500">{docLabel} &middot; {docNumber}</p>
        {meta}
      </div>
    </div>
  );
}

export function PrintFooter() {
  return (
    <div className="loi-print-footer mt-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/letterhead-footer.png" alt="Livanto Green Infra Private Limited" className="block h-auto w-full" />
    </div>
  );
}
