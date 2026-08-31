/**
 * Best-effort table extraction from a text-based PDF (a typed quotation, PO,
 * or BOQ saved/exported as PDF) -- not for scanned/image PDFs, which carry no
 * text layer at all. Reconstructs rows by clustering text runs with close Y
 * positions, then splits each row into cells wherever the X gap between runs
 * is wide enough to be a column boundary rather than a word space. Returns
 * the same unknown[][] row shape the Excel importers already work with, so
 * the header-detection/column-mapping logic in boq-parser.ts and
 * lineitem-parser.ts applies unchanged.
 */
export async function extractPdfRows(file: File): Promise<unknown[][]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Served as a plain static file from /public (copied from node_modules at commit time) rather
  // than resolved through webpack -- bundling the worker's own ESM syntax through Next's minifier
  // errors ("import/export cannot be used outside of module code"), since it's a self-contained
  // web worker script, not something meant to be imported into the app's own bundle.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const rows: unknown[][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform: number[]; width?: number }[])
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({ str: it.str as string, x: it.transform[4]!, y: it.transform[5]!, width: it.width ?? it.str!.length * 5 }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let currentY: number | null = null;
    let rowItems: typeof items = [];
    const flush = () => {
      if (!rowItems.length) return;
      rowItems.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cellText = rowItems[0]!.str;
      let lastX = rowItems[0]!.x + rowItems[0]!.width;
      // A real glyph-width-based gap: >4pt of empty space between runs is a column boundary,
      // not a word space -- using the actual PDF.js-reported width (rather than a crude
      // characters-times-average-width guess) is what makes this reliable on tightly packed
      // invoice tables, where several numeric sub-columns (rate/qty/tax %/amount) sit close
      // together and a rough estimate would glue them into one cell.
      for (let i = 1; i < rowItems.length; i++) {
        const it = rowItems[i]!;
        const gap = it.x - lastX;
        if (gap > 4) { cells.push(cellText.trim()); cellText = it.str; }
        else { cellText += (gap > 0.5 ? " " : "") + it.str; }
        lastX = it.x + it.width;
      }
      cells.push(cellText.trim());
      rows.push(cells);
      rowItems = [];
    };
    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) > 3) { flush(); currentY = it.y; }
      rowItems.push(it);
    }
    flush();
  }

  return rows;
}
