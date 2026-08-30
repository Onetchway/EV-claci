"use client";

import { collection, getDocs, limit, query } from "firebase/firestore";

import { getDb } from "./firebase/client";

export interface SearchResult {
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface SourceConfig {
  type: string;
  collectionName: string;
  matchFields: string[];
  toResult: (id: string, data: Record<string, unknown>) => SearchResult;
}

const SOURCES: SourceConfig[] = [
  { type: "Client", collectionName: "clients", matchFields: ["name", "contactName", "gstin"], toResult: (id, d) => ({ type: "Client", label: String(d.name ?? ""), sublabel: String(d.contactName ?? ""), href: `/clients/${id}` }) },
  { type: "Project", collectionName: "projects", matchFields: ["name", "code"], toResult: (id, d) => ({ type: "Project", label: String(d.name ?? ""), sublabel: String(d.code ?? ""), href: `/projects/${id}` }) },
  { type: "Tender", collectionName: "tenders", matchFields: ["title", "tenderNo"], toResult: (id, d) => ({ type: "Tender", label: String(d.title ?? d.tenderNo ?? ""), sublabel: String(d.tenderNo ?? ""), href: `/tenders/${id}` }) },
  { type: "Quotation", collectionName: "quotations", matchFields: ["quotationNo", "projectName"], toResult: (id, d) => ({ type: "Quotation", label: String(d.quotationNo ?? ""), sublabel: String(d.projectName ?? ""), href: `/quotations/${id}` }) },
  { type: "BOQ", collectionName: "boqs", matchFields: ["boqNo", "projectName", "siteName"], toResult: (id, d) => ({ type: "BOQ", label: String(d.boqNo ?? ""), sublabel: String(d.projectName ?? ""), href: `/boq/${id}` }) },
  { type: "Purchase Order", collectionName: "purchaseOrders", matchFields: ["poNo", "vendorName", "projectName"], toResult: (id, d) => ({ type: "Purchase Order", label: String(d.poNo ?? ""), sublabel: String(d.vendorName ?? ""), href: `/purchase-orders/${id}` }) },
  { type: "Proforma Invoice", collectionName: "proformaInvoices", matchFields: ["piNo", "projectName", "milestone"], toResult: (id, d) => ({ type: "Proforma Invoice", label: String(d.piNo ?? ""), sublabel: String(d.projectName ?? ""), href: `/proforma-invoices/${id}` }) },
  { type: "Vendor", collectionName: "vendors", matchFields: ["name", "contactName", "gstin"], toResult: (id, d) => ({ type: "Vendor", label: String(d.name ?? ""), sublabel: String(d.contactName ?? ""), href: `/vendors/${id}` }) },
  { type: "Issue", collectionName: "issues", matchFields: ["title", "projectName"], toResult: (id, d) => ({ type: "Issue", label: String(d.title ?? ""), sublabel: String(d.projectName ?? ""), href: `/issues` }) },
  { type: "Document", collectionName: "documents", matchFields: ["fileName"], toResult: (id, d) => ({ type: "Document", label: String(d.fileName ?? ""), sublabel: String(d.docType ?? ""), href: `/documents` }) },
];

/**
 * One-shot fetch (not live) across every entity collection, filtered
 * client-side — matches the codebase's usual avoid-composite-indexes
 * pattern, and search is inherently a one-off action, not something that
 * needs to stay live. Capped per collection so an org with thousands of
 * documents doesn't pull everything on every keystroke.
 */
export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const needle = rawQuery.trim().toLowerCase();
  if (needle.length < 2) return [];

  const perSource = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        const snap = await getDocs(query(collection(getDb(), source.collectionName), limit(500)));
        const results: SearchResult[] = [];
        for (const d of snap.docs) {
          const data = d.data();
          const hay = source.matchFields.map((f) => String(data[f] ?? "")).join(" ").toLowerCase();
          if (hay.includes(needle)) results.push(source.toResult(d.id, data));
          if (results.length >= 8) break;
        }
        return results;
      } catch {
        return [];
      }
    }),
  );

  return perSource.flat();
}
