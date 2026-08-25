export interface BankDetails {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
}

/** Read-only "pay to this account" block, printed on documents that expect payment (PO → vendor, Quotation/PI → Livanto). */
export function BankDetailsPrintBlock({ title = "Bank details", bank }: { title?: string; bank: BankDetails }) {
  const rows: [string, string | undefined][] = [
    ["Account holder", bank.accountName],
    ["Bank", bank.bankName],
    ["Account number", bank.accountNumber],
    ["IFSC", bank.ifsc],
    ["Branch", bank.branch],
  ].filter(([, v]) => v) as [string, string][];

  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <dl className="mt-1 space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-1.5 text-xs text-ink-600">
            <dt className="shrink-0 text-ink-400">{label}:</dt>
            <dd className="text-ink-800">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
