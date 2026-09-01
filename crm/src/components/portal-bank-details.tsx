"use client";

import { Banknote, Check, FileText, Loader2, Pencil, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import {
  subscribeInvestorBankDetails, submitInvestorBankDetails, validateChequeFile,
} from "@/lib/db/investor-bank-details";
import type { AppSettings, InvestorBankDetails } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500";

function LivantoBankDetails({ bank }: { bank: AppSettings["bank"] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-400">Account name</p>
        <p className="mt-0.5 text-ink-800">{bank.accountName}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-400">Bank</p>
        <p className="mt-0.5 text-ink-800">{bank.bankName}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-400">Account number</p>
        <p className="mt-0.5 font-mono text-ink-800">{bank.accountNumber}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-400">IFSC</p>
        <p className="mt-0.5 font-mono text-ink-800">{bank.ifsc}</p>
      </div>
      <div className="col-span-2">
        <p className="text-[11px] uppercase tracking-wide text-ink-400">Branch</p>
        <p className="mt-0.5 text-ink-800">{bank.branch}</p>
      </div>
    </div>
  );
}

export function PortalBankDetailsCard({ leadId, companyBank }: { leadId: string; companyBank: AppSettings["bank"] }) {
  const [details, setDetails] = useState<InvestorBankDetails | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" });
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeInvestorBankDetails(leadId, setDetails, () => setDetails(null)), [leadId]);

  function startEdit() {
    setForm({
      accountHolderName: details?.accountHolderName ?? "",
      bankName: details?.bankName ?? "",
      accountNumber: details?.accountNumber ?? "",
      ifsc: details?.ifsc ?? "",
      branch: details?.branch ?? "",
    });
    setChequeFile(null);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    if (!form.accountHolderName.trim() || !form.bankName.trim() || !form.accountNumber.trim() || !form.ifsc.trim()) {
      setError("Please fill in account holder, bank, account number and IFSC.");
      return;
    }
    setBusy(true);
    setProgress(chequeFile ? 0 : null);
    try {
      await submitInvestorBankDetails(leadId, form, chequeFile, setProgress);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message || "Could not save your bank details.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100 sm:p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <Banknote className="h-4 w-4 text-brand-600" /> Bank details & refunds
      </h2>

      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Pay Livanto Green</p>
        <LivantoBankDetails bank={companyBank} />
      </div>

      <div className="border-t border-ink-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your account, for any refund</p>
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <Pencil className="h-3 w-3" /> {details ? "Edit" : "Add details"}
            </button>
          )}
        </div>

        {!editing && details === undefined && <p className="text-sm text-ink-400">Loading…</p>}

        {!editing && details === null && (
          <p className="text-sm text-ink-500">
            No refund account on file yet. Add your bank details so we have somewhere to send a refund if one is ever due.
          </p>
        )}

        {!editing && details && (
          <div className="space-y-2.5 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Account holder</p>
                <p className="mt-0.5 text-ink-800">{details.accountHolderName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Bank</p>
                <p className="mt-0.5 text-ink-800">{details.bankName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Account number</p>
                <p className="mt-0.5 font-mono text-ink-800">{details.accountNumber}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">IFSC</p>
                <p className="mt-0.5 font-mono text-ink-800">{details.ifsc}</p>
              </div>
            </div>
            {details.chequeUrl && (
              <a
                href={details.chequeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> View uploaded cancelled cheque
              </a>
            )}
            <p className="flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="h-3 w-3" /> Submitted {formatDate(details.submittedAt)}
            </p>
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-500">Account holder name</label>
                <input className={inputClass} value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-500">Bank name</label>
                <input className={inputClass} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-500">Account number</label>
                <input className={inputClass} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-500">IFSC</label>
                <input className={inputClass} value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-ink-500">Branch (optional)</label>
                <input className={inputClass} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-ink-500">Cancelled cheque {details?.chequeUrl && "(optional — leave blank to keep the one on file)"}</label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) {
                    const problem = validateChequeFile(f);
                    if (problem) { setError(problem); return; }
                  }
                  setChequeFile(f);
                }}
                className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {progress !== null && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                disabled={busy}
                onClick={() => void save()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Save
              </button>
              <button
                disabled={busy}
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-500 hover:bg-ink-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
