"use client";

import { useEffect } from "react";

/**
 * Overrides the browser tab title (and, by extension, what Chrome
 * pre-fills as the filename when saving a page as PDF) while this
 * component is mounted, restoring whatever title was there before on
 * unmount. Without this every printed document — a Purchase Order, a
 * Quotation, a lead — saved with the same generic app title instead of
 * its own reference number.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
