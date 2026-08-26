"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

// A4 at CSS's fixed 96px/in, matching globals.css's `@page { size: A4; margin: 18mm 16mm; }`.
const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
const PAGE_VERTICAL_MARGIN_PX = 18 * 2 * MM_TO_PX;

export function PrintDocument({ header, footer, children, className }: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headerRef = useRef<HTMLTableCellElement>(null);
  const footerRef = useRef<HTMLTableCellElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  // On a short final page, the table naturally prints the footer right after
  // wherever the real content ends, instead of at the bottom of the page like
  // every earlier page. There's no CSS-only fix — the fill needed depends on
  // exactly how tall the header/footer/content render, which only the
  // browser's own print layout knows. `beforeprint` is the one moment that
  // layout is guaranteed to be settled and still synchronously readable, so
  // this measures right then and pads a trailing spacer (a plain DOM write,
  // not React state — a state update here could lose the race with print
  // actually starting) so the last page's content block is topped up to a
  // whole multiple of a page's worth, landing the footer in the same spot
  // every time.
  useEffect(() => {
    function fillLastPage() {
      if (!contentRef.current || !spacerRef.current) return;
      spacerRef.current.style.height = "0px";
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
      const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;
      const contentH = contentRef.current.getBoundingClientRect().height;
      if (!contentH) return;

      const perPagePx = PAGE_HEIGHT_PX - PAGE_VERTICAL_MARGIN_PX - headerH - footerH;
      if (perPagePx <= 0) return;

      const pages = Math.max(1, Math.ceil(contentH / perPagePx));
      spacerRef.current.style.height = `${Math.max(0, pages * perPagePx - contentH)}px`;
    }

    window.addEventListener("beforeprint", fillLastPage);
    return () => window.removeEventListener("beforeprint", fillLastPage);
  }, []);

  return (
    <table className={cn("loi-print-table", className)}>
      <thead>
        <tr><td ref={headerRef} className="loi-print-header-cell">{header}</td></tr>
      </thead>
      <tbody>
        <tr>
          <td className="loi-print-body-cell">
            <div ref={contentRef}>{children}</div>
            <div ref={spacerRef} aria-hidden="true" />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr><td ref={footerRef} className="loi-print-footer-cell">{footer}</td></tr>
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
