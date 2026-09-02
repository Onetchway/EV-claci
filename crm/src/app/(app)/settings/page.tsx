"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Landmark, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, Textarea,
  useAsyncAction,
} from "@/components/ui";
import {
  FOLLOWUP_TYPE_LABEL, FOLLOWUP_TYPES, GST_SLABS, INDIAN_STATES, type FollowupType,
} from "@/lib/constants";
import { blankSettings, saveSettings, subscribeSettings } from "@/lib/db/settings";
import { saveSequence, subscribeSequences } from "@/lib/db/tasks";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSuperAdmin, viewerIsAdmin } from "@/lib/permissions";
import type { AppSettings, FollowupSequence } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TABS = [
  "Company", "Bank", "Letter of Intent", "Finance", "Dropdown lists", "Follow-up sequences", "Investor portal",
] as const;
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
  const [form, setForm] = useState<AppSettings>(blankSettings());
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
            <Field label="Registered address" hint="The CIN's registered office." className="sm:col-span-2 lg:col-span-3">
              <Textarea
                rows={2}
                value={form.company.registeredAddress}
                onChange={(e) => set("company", { ...form.company, registeredAddress: e.target.value })}
              />
            </Field>
            <Field label="Office address" hint="Where the team actually works — shown alongside the registered address." className="sm:col-span-2 lg:col-span-3">
              <Textarea
                rows={2}
                value={form.company.officeAddress}
                onChange={(e) => set("company", { ...form.company, officeAddress: e.target.value })}
              />
            </Field>
            <Field
              label="Logo URL"
              hint="A file under /public (e.g. /logo.png) or a full https:// link. Shown on the LOI letterhead."
              className="sm:col-span-2 lg:col-span-3"
            >
              <div className="flex items-center gap-3">
                <Input
                  value={form.company.logoUrl}
                  onChange={(e) => set("company", { ...form.company, logoUrl: e.target.value })}
                  placeholder="/logo.png"
                  className="flex-1"
                />
                {form.company.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.company.logoUrl}
                    alt="Logo preview"
                    className="h-10 w-auto rounded border border-ink-200 bg-white object-contain p-1"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                )}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {tab === "Company" && (
        <Card
          title="Email notifications"
          subtitle="Agent assignment and @mentions queue an email automatically — this is how they actually get sent."
        >
          <p className="text-sm leading-relaxed text-ink-700">
            The CRM writes every notification to a <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">mail</code>{" "}
            collection in Firestore. To have those actually deliver, install the free{" "}
            <strong>&ldquo;Trigger Email&rdquo;</strong> extension once from the Firebase Console:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li>Firebase Console → your project → Extensions → Explore extensions → search &ldquo;Trigger Email&rdquo;.</li>
            <li>Install it, and when asked for the Firestore collection, use <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">mail</code>.</li>
            <li>
              Give it an SMTP connection — a Gmail account with an{" "}
              <a
                href="https://support.google.com/accounts/answer/185833"
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 underline"
              >
                app password
              </a>{" "}
              works, or a transactional sender like SendGrid/Resend for higher volume.
            </li>
          </ol>
          <p className="mt-2 text-sm text-ink-500">
            Until it&apos;s installed, notifications are queued silently — nothing breaks, emails just don&apos;t go out yet.
          </p>
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
              <Field label="Participation model" hint='Named in the LOI intro, e.g. Franchise-Owned, Company-Operated ("FOCO")'>
                <Input value={form.loi.model} onChange={(e) => set("loi", { ...form.loi, model: e.target.value })} />
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
            <Field label="Default GST %" hint="Chargers are 5% (HSN 8504 EVSE); civil/electrical items are 18%.">
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

      {tab === "Follow-up sequences" && <SequencesEditor actor={actor!} />}

      {tab === "Investor portal" && <InvestorPortalTab isSuperAdmin={isSuperAdmin(viewer.role)} />}
    </>
  );
}

/** Read-only phone/OTP portal (/portal) investors and franchise partners use to check their own lead's progress — see /portal/login. */
function InvestorPortalTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { busy, run } = useAsyncAction();
  const [result, setResult] = useState<number | null>(null);

  return (
    <Card
      title="Investor / franchise partner portal"
      subtitle="A separate, view-only site at /portal — investors sign in with their phone number and an OTP (no CRM account) and see their own lead's stage, EOI, agreement, project progress and photos, payments and loan status."
    >
      <div className="space-y-4 text-sm text-ink-700">
        <p>
          Matching works off each lead&apos;s client phone number, normalised to +91 form. A lead created
          or edited from now on keeps this in sync automatically — this button is only for leads that
          existed before the portal did, or that somehow drifted out of sync.
        </p>
        {isSuperAdmin ? (
          <Button
            loading={busy}
            onClick={() =>
              void run(async () => {
                const current = getFirebaseAuth().currentUser;
                if (!current) throw new Error("Your session expired. Sign in again.");
                const token = await current.getIdToken();
                const res = await fetch("/api/leads/backfill-investor-phone", {
                  method: "POST",
                  headers: { authorization: `Bearer ${token}` },
                });
                const body = (await res.json().catch(() => ({}))) as { error?: string; updated?: number };
                if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
                setResult(body.updated ?? 0);
              }, "Investor phone numbers synced.")
            }
          >
            Sync investor phone numbers
          </Button>
        ) : (
          <p className="text-xs text-ink-500">Only a Super Admin can run the sync.</p>
        )}
        {result !== null && (
          <p className="text-xs text-ink-500">{result === 0 ? "Everything was already in sync." : `Updated ${result} lead${result === 1 ? "" : "s"}.`}</p>
        )}
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
          One-time setup this needs outside the app: enable the <strong>Phone</strong> sign-in provider under
          Firebase Console → Authentication → Sign-in method. SMS OTPs are billed by Firebase/Google beyond its
          free monthly quota.
        </p>
      </div>
    </Card>
  );
}

/** Admin-configured follow-up sequences — applied on demand from a lead's Tasks tab. */
function SequencesEditor({ actor }: { actor: NonNullable<ReturnType<typeof useAuth>["actor"]> }) {
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FollowupSequence | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeSequences((r) => { setSequences(r); setLoading(false); }, () => setLoading(false)), []);

  function newSequence(): FollowupSequence {
    return {
      id: "",
      name: "",
      active: true,
      steps: [{ dayOffset: 0, type: "CALL", title: "Welcome call" }],
      createdAt: null,
    };
  }

  return (
    <div className="space-y-4">
      <Card
        title="Follow-up sequences"
        subtitle="Day 0, Day 1, Day 3… Applied on demand from a lead's Tasks tab, never automatically."
        actions={<Button size="sm" onClick={() => setEditing(newSequence())}><Plus className="h-4 w-4" /> New sequence</Button>}
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
        ) : sequences.length === 0 ? (
          <EmptyState title="No sequences yet" description="Build a Day 0 / Day 1 / Day 3 follow-up cadence agents can apply to any lead." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {sequences.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                    {s.name}
                    {!s.active && <span className="chip bg-ink-100 text-ink-500 ring-ink-200">Inactive</span>}
                  </p>
                  <p className="text-xs text-ink-500">{s.steps.length} steps</p>
                </div>
                <Button size="sm" onClick={() => setEditing(s)}>Edit</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <Card title={editing.id ? "Edit sequence" : "New sequence"}>
          <div className="space-y-3">
            <Field label="Name" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="New franchise lead cadence" />
            </Field>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              <span className="text-sm text-ink-700">Active — visible to agents to apply</span>
            </div>

            <div>
              <p className="label">Steps</p>
              <div className="space-y-2">
                {editing.steps.map((step, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[80px_140px_1fr_auto] items-start rounded-lg border border-ink-200 p-2">
                    <Field label="Day">
                      <Input
                        type="number"
                        min={0}
                        value={step.dayOffset}
                        onChange={(e) => {
                          const steps = [...editing.steps];
                          steps[i] = { ...step, dayOffset: Number(e.target.value) || 0 };
                          setEditing({ ...editing, steps });
                        }}
                      />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={step.type}
                        onChange={(e) => {
                          const steps = [...editing.steps];
                          steps[i] = { ...step, type: e.target.value as FollowupType };
                          setEditing({ ...editing, steps });
                        }}
                        options={FOLLOWUP_TYPES.map((t) => ({ value: t, label: FOLLOWUP_TYPE_LABEL[t] }))}
                      />
                    </Field>
                    <Field label="Title">
                      <Input
                        value={step.title}
                        onChange={(e) => {
                          const steps = [...editing.steps];
                          steps[i] = { ...step, title: e.target.value };
                          setEditing({ ...editing, steps });
                        }}
                      />
                    </Field>
                    <div className="flex items-end pb-2">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })}
                        className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove step ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    steps: [...editing.steps, { dayOffset: (editing.steps.at(-1)?.dayOffset ?? 0) + 1, type: "CALL", title: "" }],
                  })
                }
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add step
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (!editing.name.trim()) throw new Error("Give the sequence a name.");
                    await saveSequence(
                      { id: editing.id || undefined, name: editing.name.trim(), active: editing.active, steps: editing.steps },
                      actor,
                    );
                    setEditing(null);
                  }, "Sequence saved.")
                }
              >
                Save
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
