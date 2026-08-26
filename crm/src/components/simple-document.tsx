import type { ReactNode } from "react";

/**
 * Plain document header/footer — company name or logo, doc type/number, and
 * a legal-details footer. Used by every printed document except the Letter
 * of Intent (which uses the full letterhead banner artwork in
 * print-letterhead.tsx) — Quotation, Proforma Invoice, Purchase Order and
 * Tax Invoice print as a simple bordered page, the same treatment the
 * Payment Receipt has always had, rather than the letterhead.
 */

export interface Company {
  legalName: string;
  shortName: string;
  registeredAddress: string;
  officeAddress: string;
  gstin: string;
  cin: string;
  email?: string;
  website?: string;
  logoUrl: string;
}

export function SimpleDocumentHeader({
  company, docLabel, docNumber, meta,
}: {
  company: Company;
  docLabel: string;
  docNumber: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt={company.shortName}
          width={197}
          height={40}
          className="h-10 w-auto shrink-0"
        />
      ) : (
        <p className="text-lg font-bold tracking-tight text-ink-900">{company.legalName}</p>
      )}
      <div className="text-right">
        <p className="text-xs text-ink-500">{docLabel} &middot; {docNumber}</p>
        {meta}
        {(company.email || company.website) && (
          <p className="mt-1 text-[11px] text-ink-400">
            {company.email}
            {company.email && company.website && <> &nbsp;|&nbsp; </>}
            {company.website}
          </p>
        )}
      </div>
    </div>
  );
}

export function SimpleDocumentFooter({ company }: { company: Company }) {
  return (
    <footer className="mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
      <p>{company.legalName}</p>
      <p>
        {[company.gstin && `GSTN. ${company.gstin}`, company.cin && `CIN. ${company.cin}`]
          .filter(Boolean)
          .join(" | ")}
      </p>
      <p>Registered address: {company.registeredAddress}</p>
      <p>Office address: {company.officeAddress}</p>
    </footer>
  );
}
