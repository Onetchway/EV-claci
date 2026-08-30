"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, PageHeader, Spinner, useAsyncAction, useToast } from "@/components/ui";
import { COMPANY_INFO } from "@/lib/constants";
import { defaultSettings, saveSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import { isAdmin } from "@/lib/permissions";

export default function SettingsPage() {
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  const [form, setForm] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeSettings((s) => { setForm(s); setLoading(false); }, () => setLoading(false)), []);

  if (!isAdmin(viewer.role)) {
    return <EmptyState title="Admins only" description="Settings are visible to admins and super admins." />;
  }

  async function onSave() {
    await run(() => saveSettings(form, actor), "Settings saved.");
    push("Settings saved.", "success");
  }

  if (loading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Company profile printed on every document, and the bank details shown on quotations, POs and invoices."
        actions={<Button variant="primary" loading={busy} onClick={() => void onSave()}>Save changes</Button>}
      />

      <Card title="Company profile" subtitle="Printed on every Quotation / PO / PI / BOQ letterhead. To change these legal details or the logo, contact your developer — they're set once at deploy time.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-ink-500">Legal name</dt><dd className="text-ink-900">{COMPANY_INFO.name}</dd></div>
          <div><dt className="text-xs text-ink-500">GSTIN</dt><dd className="text-ink-900">{COMPANY_INFO.gstin}</dd></div>
          <div><dt className="text-xs text-ink-500">CIN</dt><dd className="text-ink-900">{COMPANY_INFO.cin}</dd></div>
          <div><dt className="text-xs text-ink-500">Email</dt><dd className="text-ink-900">{COMPANY_INFO.email}</dd></div>
          <div><dt className="text-xs text-ink-500">Website</dt><dd className="text-ink-900">{COMPANY_INFO.website}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Registered address</dt><dd className="text-ink-900">{COMPANY_INFO.registeredAddress}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Office address</dt><dd className="text-ink-900">{COMPANY_INFO.officeAddress}</dd></div>
        </dl>
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
    </div>
  );
}
