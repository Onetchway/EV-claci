"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Landmark, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea,
  useAsyncAction,
} from "@/components/ui";
import { GST_SLABS, INDIAN_STATES } from "@/lib/constants";
import { defaultSettings, saveSettings, subscribeSettings } from "@/lib/db/settings";
import { viewerIsAdmin } from "@/lib/permissions";
import type { AppSettings } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TABS = ["Company", "Bank", "Letter of Intent", "Finance", "Dropdown lists"] as const;
type Tab = (typeof TABS)[number];

/** A simple add/remove editor for the custom dropdown options. */
function ListEditor({
  label, hint, items, onChange, placeholder,
}: {
  label: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) { setDraft(""); return; }
    onChange([...items, v]);
    setDraft("");
  }

  return (
    <div>
      <p className="label">{label}</p>
      <p className="mb-2 text-xs text-ink-500">{hint}</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i} className="chip bg-ink-100 text-ink-700 ring-ink-200">
              {i}
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x !== i))}
                className="ml-0.5 text-ink-400 hover:text-rose-600"
                aria-label={`Remove ${i}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [stored, setStored] = useState<AppSettings | null>(null);
  const [form, setForm] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Company");

  useEffect(() => {
    if (!viewerIsAdmin(viewer)) { setLoading(false); return; }
    return subscribeSettings(
      (s) => { setStored(s); setForm(s); setLoading(false); },
      () => setLoading(false),
    );
  }, [viewer]);

  if (!viewerIsAdmin(viewer)) {
    return (
      <EmptyState
        icon={<SettingsIcon className="h-8 w-8" />}
        title="Admins only"
        description="Application settings are restricted to admins and super admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details, bank account, Letter of Intent defaults and the dropdown lists."
        actions={
          <>
            {dirty && <Button onClick={() => stored && setForm(stored)}>Discard changes</Button>}
            <Button
              variant="primary"
              disabled={!dirty}
              loading={busy}
              onClick={() => void run(() => saveSettings(form, actor!), "Settings saved.")}
            >
              Save changes
            </Button>
          </>
        }
      />

      {stored?.updatedAt && (
        <p className="mb-4 text-xs text-ink-500">
          Last updated {formatDateTime(stored.updatedAt)}
          {stored.updatedBy ? ` by ${stored.updatedBy.name}` : ""}.
        </p>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200 scroll-thin">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Company" && (
        <Card
          title="Company details"
          subtitle="Printed at the top of every Letter of Intent."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Legal name" required className="sm:col-span-2">
              <Input
                value={form.company.legalName}
                onChange={(e) => set("company", { ...form.company, legalName: e.target.value })}
              />
            </Field>
            <Field label="Short name" hint="Used inside clause text, e.g. “Livanto shall…”.">
              <Input
                value={form.company.shortName}
                onChange={(e) => set("company", { ...form.company, shortName: e.target.value })}
              />
            </Field>
            <Field label="GSTIN">
              <Input
                value={form.company.gstin}
                maxLength={15}
                onChange={(e) => set("company", { ...form.company, gstin: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="CIN">
              <Input
                value={form.company.cin}
                onChange={(e) => set("company", { ...form.company, cin: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.company.website}
                onChange={(e) => set("company", { ...form.company, website: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.company.email}
                onChange={(e) => set("company", { ...form.company, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.company.phone}
                onChange={(e) => set("company", { ...form.company, phone: e.target.value })}
              />
            </Field>
            <Field label="Registered address" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                rows={2}
                value={form.company.address}
                onChange={(e) => set("company", { ...form.company, address: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      )}

      {tab === "Bank" && (
        <Card
          title="Bank account for remittance"
          subtitle="Appears in the Bank Details table of every Letter of Intent."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name">
              <Input value={form.bank.accountName} onChange={(e) => set("bank", { ...form.bank, accountName: e.target.value })} />
            </Field>
            <Field label="Bank name">
              <Input value={form.bank.bankName} onChange={(e) => set("bank", { ...form.bank, bankName: e.target.value })} />
            </Field>
            <Field label="Account number">
              <Input value={form.bank.accountNumber} onChange={(e) => set("bank", { ...form.bank, accountNumber: e.target.value })} />
            </Field>
            <Field label="IFSC code">
              <Input
                value={form.bank.ifsc}
                maxLength={11}
                onChange={(e) => set("bank", { ...form.bank, ifsc: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Branch" className="sm:col-span-2">
              <Input value={form.bank.branch} onChange={(e) => set("bank", { ...form.bank, branch: e.target.value })} />
            </Field>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
            These details go out on every letter you issue. Double-check the account number and IFSC
            before saving — a typo here sends client money to the wrong place.
          </p>
        </Card>
      )}

      {tab === "Letter of Intent" && (
        <div className="space-y-4">
          <Card title="Defaults" subtitle="Applied to each new letter; still editable per deal.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Project tenure (years)">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.loi.tenureYears}
                  onChange={(e) => set("loi", { ...form.loi, tenureYears: Number(e.target.value) || 10 })}
                />
              </Field>
              <Field label="Payout period (months)">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={form.loi.payoutMonths}
                  onChange={(e) => set("loi", { ...form.loi, payoutMonths: Number(e.target.value) || 24 })}
                />
              </Field>
              <Field label="Signatory">
                <Input value={form.loi.signatory} onChange={(e) => set("loi", { ...form.loi, signatory: e.target.value })} />
              </Field>
              <Field label="Arbitration seat">
                <Input
                  list="seat-list"
                  value={form.loi.arbitrationSeat}
                  onChange={(e) => set("loi", { ...form.loi, arbitrationSeat: e.target.value })}
                />
                <datalist id="seat-list">
                  {INDIAN_STATES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label="Jurisdiction (courts at)">
                <Input value={form.loi.jurisdiction} onChange={(e) => set("loi", { ...form.loi, jurisdiction: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="Scope of obligations" subtitle="The default bullet list on each letter.">
            <ul className="space-y-2">
              {form.loi.scopeItems.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) =>
                      set("loi", {
                        ...form.loi,
                        scopeItems: form.loi.scopeItems.map((s, j) => (j === i ? e.target.value : s)),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set("loi", { ...form.loi, scopeItems: form.loi.scopeItems.filter((_, j) => j !== i) })
                    }
                    className="shrink-0 rounded p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove item ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => set("loi", { ...form.loi, scopeItems: [...form.loi.scopeItems, ""] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </Card>

          <Card title="Closing paragraph">
            <Textarea
              rows={4}
              value={form.loi.closing}
              onChange={(e) => set("loi", { ...form.loi, closing: e.target.value })}
            />
          </Card>
        </div>
      )}

      {tab === "Finance" && (
        <Card title="Financial defaults" subtitle="Starting values for new quotations and loan estimates.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Default GST %" hint="Chargers are normally 18%.">
              <select
                value={form.finance.defaultGstPct}
                onChange={(e) => set("finance", { ...form.finance, defaultGstPct: Number(e.target.value) })}
                className="input"
              >
                {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
            </Field>
            <Field label="Bank funding (LTV)" hint="Share of the total a bank typically funds.">
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(form.finance.loanToValue * 100)}
                onChange={(e) =>
                  set("finance", { ...form.finance, loanToValue: Math.min(100, Number(e.target.value) || 0) / 100 })
                }
              />
            </Field>
            <Field label="Default interest rate (% p.a.)">
              <Input
                type="number"
                min={0}
                step={0.05}
                value={form.finance.defaultInterestRate}
                onChange={(e) => set("finance", { ...form.finance, defaultInterestRate: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Default loan tenure (years)">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.finance.defaultTenureYears}
                onChange={(e) => set("finance", { ...form.finance, defaultTenureYears: Number(e.target.value) || 5 })}
              />
            </Field>
          </div>

          <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
            Charger prices and modelled returns come from the Livanto investment workbook and are
            deliberately not editable here — <code>npm run verify</code> checks them against that
            workbook on every build. Individual deals can still override a price on the quotation.
          </p>
        </Card>
      )}

      {tab === "Dropdown lists" && (
        <Card
          title="Custom dropdown options"
          subtitle="Added alongside the built-in choices, not instead of them."
        >
          <div className="space-y-6">
            <ListEditor
              label="Charger OEMs"
              hint="Manufacturers beyond the built-in list."
              items={form.lists.chargerOems}
              onChange={(v) => set("lists", { ...form.lists, chargerOems: v })}
              placeholder="e.g. Fortum, Magenta"
            />
            <ListEditor
              label="Banks & lenders"
              hint="Lenders your customers actually use."
              items={form.lists.banks}
              onChange={(v) => set("lists", { ...form.lists, banks: v })}
              placeholder="e.g. Ujjivan Small Finance Bank"
            />
            <ListEditor
              label="DISCOMs"
              hint="Electricity distribution companies in your regions."
              items={form.lists.discoms}
              onChange={(v) => set("lists", { ...form.lists, discoms: v })}
              placeholder="e.g. MSEDCL, BSES Rajdhani, UPPCL"
            />
            <ListEditor
              label="Vendors & contractors"
              hint="Civil and electrical contractors you assign to workstreams."
              items={form.lists.vendors}
              onChange={(v) => set("lists", { ...form.lists, vendors: v })}
              placeholder="e.g. Sharma Constructions"
            />
          </div>
        </Card>
      )}

      {tab === "Company" && (
        <p className="mt-4 flex items-start gap-2 text-xs text-ink-500">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          Changes take effect on newly generated letters. Letters already issued keep the details
          they were issued with — that is deliberate, so an issued document never changes after
          the fact.
        </p>
      )}
    </>
  );
}
