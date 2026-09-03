"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import type { AppSettings, BankDetails } from "@/lib/db/settings";
import { defaultSettings, subscribeSettings } from "@/lib/db/settings";
import { Button } from "@/components/ui";

/**
 * Shared letterhead for every printed document — Quotation, Purchase
 * Order, Proforma Invoice and BOQ all print as a simple bordered page
 * carrying the company logo + GSTIN/CIN at the top and the registered/office
 * address in the footer, matching the company letterhead. Reads live from
 * Settings → Company profile (falls back to the deploy-time default while
 * that first snapshot loads, so there's no flash of blank content).
 */
export function useCompanyInfo() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  useEffect(() => subscribeSettings(setSettings), []);
  return settings.company;
}

export function PrintHeader({ docLabel, docNumber, meta }: {
  docLabel: string;
  docNumber: string;
  meta?: ReactNode;
}) {
  const company = useCompanyInfo();
  return (
    <div className="mb-4 border-b-2 border-brand-600 pb-3">
      <div className="flex items-start justify-between gap-4">
        <Image src={company.logoUrl || "/logo.png"} alt={company.name} width={180} height={58} priority className="h-12 w-auto" unoptimized={company.logoUrl.startsWith("http")} />
        <div className="text-right text-ink-500">
          <p className="text-sm font-semibold text-navy-900">{docLabel} &middot; {docNumber}</p>
          {meta}
          <p className="mt-0.5 text-[11px]">{company.email}{company.website ? <>&nbsp;|&nbsp; {company.website}</> : null}</p>
        </div>
      </div>
    </div>
  );
}

export function PrintFooter() {
  const company = useCompanyInfo();
  return (
    <footer className="mt-6 border-t-2 border-brand-600 pt-2 text-[10px] leading-tight text-ink-500">
      <div className="grid grid-cols-3 divide-x divide-ink-200">
        <div className="pr-4">
          <p className="font-semibold text-ink-700">{company.name}</p>
          <p className="mt-0.5">GSTIN: {company.gstin} &nbsp;|&nbsp; CIN: {company.cin}</p>
          <p className="mt-0.5">{company.email}</p>
          <p>{company.website}</p>
        </div>
        <div className="px-4">
          <p className="font-semibold uppercase tracking-wide text-ink-500">Registered Address</p>
          <p className="mt-0.5">{company.registeredAddress}</p>
        </div>
        <div className="pl-4">
          <p className="font-semibold uppercase tracking-wide text-ink-500">Office Address</p>
          <p className="mt-0.5">{company.officeAddress}</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Sets the browser tab title while a print page is mounted, restoring the
 * previous title on unmount -- the tab title is what Chrome's "Save as PDF"
 * pre-fills as the download filename, so this is what makes an exported PDF
 * save as e.g. "NAKJM PO NKJM-PO-00007.pdf" instead of the app's generic title.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="mb-4 flex items-center justify-between print:hidden">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <Button variant="primary" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / Save as PDF
      </Button>
    </div>
  );
}

export function BankDetailsPrintBlock({ bank }: { bank: BankDetails | null | undefined }) {
  if (!bank || !bank.accountNo) return null;
  return (
    <div className="mt-6 rounded-lg border border-ink-200 px-4 py-3 text-xs">
      <p className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Bank Details</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-ink-700">
        {bank.accountName && <p><span className="text-ink-500">Account name: </span>{bank.accountName}</p>}
        {bank.bankName && <p><span className="text-ink-500">Bank: </span>{bank.bankName}</p>}
        {bank.accountNo && <p><span className="text-ink-500">Account no.: </span>{bank.accountNo}</p>}
        {bank.ifsc && <p><span className="text-ink-500">IFSC: </span>{bank.ifsc}</p>}
        {bank.branch && <p><span className="text-ink-500">Branch: </span>{bank.branch}</p>}
      </div>
    </div>
  );
}

export function PrintSheet({ children }: { children: ReactNode }) {
  return (
    <article className="print-sheet mx-auto max-w-3xl rounded-xl border border-ink-200 bg-white p-8 shadow-card">
      {children}
    </article>
  );
}
