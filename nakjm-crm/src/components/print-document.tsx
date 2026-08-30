"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import { COMPANY_INFO } from "@/lib/constants";
import type { BankDetails } from "@/lib/db/settings";
import { Button } from "@/components/ui";

/**
 * Shared letterhead for every printed document — Quotation, Purchase
 * Order, Proforma Invoice and BOQ all print as a simple bordered page
 * carrying the NAKJM logo + GSTIN/CIN at the top and the registered/office
 * address in the footer, matching the company letterhead.
 */
export function PrintHeader({ docLabel, docNumber, meta }: {
  docLabel: string;
  docNumber: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-4 border-b-2 border-brand-600 pb-3">
      <div className="flex items-start justify-between gap-4">
        <Image src="/logo.png" alt={COMPANY_INFO.name} width={180} height={58} priority className="h-12 w-auto" />
        <div className="text-right text-[11px] leading-tight text-ink-500">
          <p>GSTIN: {COMPANY_INFO.gstin}</p>
          <p>CIN: {COMPANY_INFO.cin}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <h1 className="text-lg font-bold uppercase tracking-wide text-navy-900">{docLabel}</h1>
        <div className="text-right text-sm">
          <p className="font-semibold text-ink-900">{docNumber}</p>
          {meta}
        </div>
      </div>
    </div>
  );
}

export function PrintFooter() {
  return (
    <footer className="mt-6 border-t-2 border-brand-600 pt-2 text-center text-[10px] leading-tight text-ink-400">
      <p className="font-semibold text-ink-600">{COMPANY_INFO.name}</p>
      <p>{COMPANY_INFO.email} &nbsp;|&nbsp; {COMPANY_INFO.website}</p>
      <div className="mt-1 grid grid-cols-2 gap-4 text-left">
        <p><span className="font-medium text-ink-500">Registered address: </span>{COMPANY_INFO.registeredAddress}</p>
        <p><span className="font-medium text-ink-500">Office address: </span>{COMPANY_INFO.officeAddress}</p>
      </div>
    </footer>
  );
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
