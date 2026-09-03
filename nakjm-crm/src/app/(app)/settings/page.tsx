"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Landmark, Plus, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { PROJECT_TYPES, type ProjectType } from "@/lib/constants";
import { saveProjectTemplate, subscribeProjectTemplates } from "@/lib/db/project-templates";
import { defaultSettings, saveSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import { isAdmin } from "@/lib/permissions";

export default function SettingsPage() {
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  const [form, setForm] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Record<ProjectType, string[]> | null>(null);
  const [templateType, setTemplateType] = useState<ProjectType>("EV_CHARGING_STATION");
  const [templateStages, setTemplateStages] = useState<string[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const { busy: templateBusy, run: runTemplate } = useAsyncAction();

  useEffect(() => subscribeSettings((s) => { setForm(s); setLoading(false); }, () => setLoading(false)), []);
  useEffect(() => subscribeProjectTemplates(setTemplates), []);
  useEffect(() => { if (templates) setTemplateStages(templates[templateType]); }, [templates, templateType]);

  if (!isAdmin(viewer.role)) {
    return <EmptyState title="Admins only" description="Settings are visible to admins and super admins." />;
  }

  async function onSave() {
    await run(() => saveSettings(form, actor), "Settings saved.");
    push("Settings saved.", "success");
  }

  function moveStage(i: number, dir: -1 | 1) {
    setTemplateStages((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeStage(i: number) {
    setTemplateStages((s) => s.filter((_, idx) => idx !== i));
  }

  function addStage() {
    if (!newStageName.trim()) return;
    setTemplateStages((s) => [...s, newStageName.trim()]);
    setNewStageName("");
  }

  async function onSaveTemplate() {
    await runTemplate(() => saveProjectTemplate(templateType, templateStages, actor), "Template saved.");
  }

  if (loading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Company profile printed on every document, and the bank details shown on quotations, POs and invoices."
        actions={<Button variant="primary" loading={busy} onClick={() => void onSave()}>Save changes</Button>}
      />

      <Card title="Company profile" subtitle="Printed on every Quotation / PO / PI / BOQ letterhead.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name"><Input value={form.company.name} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, name: e.target.value } }))} /></Field>
          <Field label="GSTIN"><Input value={form.company.gstin} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, gstin: e.target.value } }))} /></Field>
          <Field label="CIN"><Input value={form.company.cin} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, cin: e.target.value } }))} /></Field>
          <Field label="Email"><Input value={form.company.email} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, email: e.target.value } }))} /></Field>
          <Field label="Website"><Input value={form.company.website} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, website: e.target.value } }))} /></Field>
          <Field label="Logo URL" hint="A file under /public (e.g. /logo.png) or a full https:// link."><Input value={form.company.logoUrl} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, logoUrl: e.target.value } }))} /></Field>
          <Field label="Registered address" className="sm:col-span-2"><Textarea value={form.company.registeredAddress} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, registeredAddress: e.target.value } }))} /></Field>
          <Field label="Office address" className="sm:col-span-2"><Textarea value={form.company.officeAddress} onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, officeAddress: e.target.value } }))} /></Field>
        </div>
      </Card>

      <Card title="Bank details" subtitle="Shown on printed Purchase Orders and Proforma Invoices so vendors and clients know where to pay.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account name"><Input value={form.bank.accountName} onChange={(e) => setForm((f) => ({ ...f, bank: { ...f.bank, accountName: e.target.value } }))} /></Field>
          <Field label="Bank name"><Input value={form.bank.bankName} onChange={(e) => setForm((f) => ({ ...f, bank: { ...f.bank, bankName: e.target.value } }))} /></Field>
          <Field label="Account number"><Input value={form.bank.accountNo} onChange={(e) => setForm((f) => ({ ...f, bank: { ...f.bank, accountNo: e.target.value } }))} /></Field>
          <Field label="IFSC"><Input value={form.bank.ifsc} onChange={(e) => setForm((f) => ({ ...f, bank: { ...f.bank, ifsc: e.target.value } }))} /></Field>
          <Field label="Branch" className="sm:col-span-2"><Input value={form.bank.branch} onChange={(e) => setForm((f) => ({ ...f, bank: { ...f.bank, branch: e.target.value } }))} /></Field>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500"><Landmark className="h-3.5 w-3.5" /> Leave blank to omit the bank block from printed documents.</p>
      </Card>

      <Card title="Tally integration" subtitle="Ledger names used when exporting a PO or PI as a Tally-importable voucher — must match the ledgers in your Tally company exactly.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Purchase account ledger" hint="Used on PO exports."><Input value={form.tally.purchaseLedger} onChange={(e) => setForm((f) => ({ ...f, tally: { ...f.tally, purchaseLedger: e.target.value } }))} /></Field>
          <Field label="Sales account ledger" hint="Used on PI exports."><Input value={form.tally.salesLedger} onChange={(e) => setForm((f) => ({ ...f, tally: { ...f.tally, salesLedger: e.target.value } }))} /></Field>
          <Field label="IGST ledger"><Input value={form.tally.igstLedger} onChange={(e) => setForm((f) => ({ ...f, tally: { ...f.tally, igstLedger: e.target.value } }))} /></Field>
          <Field label="CGST ledger"><Input value={form.tally.cgstLedger} onChange={(e) => setForm((f) => ({ ...f, tally: { ...f.tally, cgstLedger: e.target.value } }))} /></Field>
          <Field label="SGST ledger"><Input value={form.tally.sgstLedger} onChange={(e) => setForm((f) => ({ ...f, tally: { ...f.tally, sgstLedger: e.target.value } }))} /></Field>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          The party ledger (vendor or client name) must also already exist in Tally with that exact name. Exported vouchers are ledger-only — line items are listed in the voucher narration for reference, not posted as individual stock items. Import via Tally: Gateway of Tally → Import Data → select the downloaded XML file.
        </p>
      </Card>

      <Card
        title="Project stage templates"
        subtitle="The default stage sequence a project gets when someone clicks &quot;Generate from template&quot; on its Stages tab. Add, remove, rename or reorder stages per project type."
        actions={<Button loading={templateBusy} onClick={() => void onSaveTemplate()}>Save template</Button>}
      >
        <Field label="Project Type" className="mb-4 max-w-xs">
          <Select value={templateType} options={PROJECT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} onChange={(e) => setTemplateType(e.target.value as ProjectType)} />
        </Field>

        {!templates ? (
          <p className="text-sm text-ink-400">Loading…</p>
        ) : (
          <div className="space-y-1.5">
            {templateStages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-xs text-ink-400">{i + 1}.</span>
                <Input value={stage} onChange={(e) => setTemplateStages((s) => s.map((v, idx) => (idx === i ? e.target.value : v)))} />
                <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveStage(i, 1)} disabled={i === templateStages.length - 1} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => removeStage(i)} className="rounded p-1 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <span className="w-6 shrink-0" />
              <Input value={newStageName} placeholder="New stage name…" onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStage(); }} />
              <Button variant="secondary" size="sm" onClick={addStage}><Plus className="h-3.5 w-3.5" /> Add</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
