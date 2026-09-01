"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import {
  createOrganization, deleteOrganization, setOrganizationActive, subscribeOrganizations, updateOrganization,
  type OrganizationDraft,
} from "@/lib/db/organizations";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSuperAdmin } from "@/lib/permissions";
import type { Organization } from "@/lib/types";

const blankDraft: OrganizationDraft = { name: "", slug: "", logoUrl: "", primaryColorHex: "", customDomain: "", acLicenseTotal: undefined, dcLicenseTotal: undefined, razorpayKeyId: "" };

export default function OrganizationsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = isSuperAdmin(viewer.role);
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [draft, setDraft] = useState<OrganizationDraft>(blankDraft);
  const [keySecretInput, setKeySecretInput] = useState("");
  const [platformKeyInput, setPlatformKeyInput] = useState("");
  const [platformKeyBusy, setPlatformKeyBusy] = useState(false);
  const [secretBusy, setSecretBusy] = useState(false);

  useEffect(() => subscribeOrganizations(setOrgs), []);

  function openNew() {
    setEditing(null);
    setDraft(blankDraft);
    setKeySecretInput("");
    setOpen(true);
  }

  function openEdit(o: Organization) {
    setEditing(o);
    setDraft({
      name: o.name, slug: o.slug ?? "", logoUrl: o.logoUrl ?? "", primaryColorHex: o.primaryColorHex ?? "", customDomain: o.customDomain ?? "",
      acLicenseTotal: o.acLicenseTotal, dcLicenseTotal: o.dcLicenseTotal, razorpayKeyId: o.razorpayKeyId ?? "",
    });
    setKeySecretInput("");
    setOpen(true);
  }

  async function submit() {
    if (!actor || !draft.name.trim()) return;
    const clean: OrganizationDraft = {
      name: draft.name.trim(),
      slug: draft.slug?.trim().toLowerCase() || undefined,
      logoUrl: draft.logoUrl?.trim() || undefined,
      primaryColorHex: draft.primaryColorHex?.trim() || undefined,
      customDomain: draft.customDomain?.trim() || undefined,
      acLicenseTotal: draft.acLicenseTotal || undefined,
      dcLicenseTotal: draft.dcLicenseTotal || undefined,
      razorpayKeyId: draft.razorpayKeyId?.trim() || undefined,
    };
    await run(async () => {
      if (editing) await updateOrganization(editing.id, clean);
      else await createOrganization(clean, actor);
      setOpen(false);
    }, editing ? "Organisation updated." : "Organisation created.");
  }

  async function submitKeySecret() {
    if (!editing) return;
    setSecretBusy(true);
    try {
      const current = getFirebaseAuth().currentUser;
      if (!current) throw new Error("Your session expired. Sign in again.");
      const token = await current.getIdToken();
      const res = await fetch(`/api/organizations/${editing.id}/payment-secret`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ razorpayKeySecret: keySecretInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      setKeySecretInput("");
      push(keySecretInput.trim() ? "Key secret saved." : "Key secret cleared — this tenant's payments will use the platform account again.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setSecretBusy(false);
    }
  }

  async function submitPlatformKey() {
    if (!editing) return;
    setPlatformKeyBusy(true);
    try {
      const current = getFirebaseAuth().currentUser;
      if (!current) throw new Error("Your session expired. Sign in again.");
      const token = await current.getIdToken();
      const res = await fetch(`/api/organizations/${editing.id}/platform-key`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantApiKey: platformKeyInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      setPlatformKeyInput("");
      push(platformKeyInput.trim() ? "Platform key saved." : "Platform key cleared — every feature is enabled for this tenant again.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setPlatformKeyBusy(false);
    }
  }

  if (!canManage) {
    return <EmptyState title="Super admins only" description="Organisation (white-label) management is restricted to super admins." />;
  }

  return (
    <>
      <PageHeader
        title="Tenants (White Label)"
        description="Tenant registry — branding, licenses, and payment/platform keys per organisation. Leads (Sales) are fully isolated between organisations; the rest of the app (Operations, HRMS, chargers, sessions, etc.) is not yet — that scoping is applied module by module, following the same pattern as leads.ts and firestore.rules."
        actions={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New organisation</Button>}
      />

      {orgs === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No organisations yet"
          description="Every team member is on Livanto's own default branding until you create one and assign it to them under Team & Roles."
          action={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New organisation</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((o) => (
            <Card key={o.id} title={o.name} subtitle={o.customDomain || "No custom domain set"}>
              <div className="flex items-center gap-3">
                {o.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: o.primaryColorHex || "#1fae54" }}
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                )}
                <Badge className={o.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                  {o.active ? "Active" : "Disabled"}
                </Badge>
                {!!o.acLicenseTotal && <Badge className="bg-ink-100 text-ink-600 ring-ink-200">AC: {o.acLicenseTotal}</Badge>}
                {!!o.dcLicenseTotal && <Badge className="bg-ink-100 text-ink-600 ring-ink-200">DC: {o.dcLicenseTotal}</Badge>}
              </div>
              <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                <Button size="sm" onClick={() => openEdit(o)}>Edit</Button>
                <Button size="sm" onClick={() => void run(() => setOrganizationActive(o.id, !o.active))}>
                  {o.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!window.confirm(`Delete ${o.name}? Any team members assigned to it will fall back to the default organisation.`)) return;
                    void run(() => deleteOrganization(o.id), "Organisation deleted.");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit organisation" : "New organisation"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!draft.name.trim()} onClick={() => void submit()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Acme EV Charging" />
          </Field>
          <Field label="Slug" hint="URL segment for this tenant's own CRM, e.g. app.alpha.com/xpulse. Also what matches this org to its Alpha platform tenant record.">
            <Input value={draft.slug ?? ""} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="xpulse" />
          </Field>
          <Field label="Logo URL" hint="Shown in the sidebar in place of the Livanto logo for this org's team members.">
            <Input value={draft.logoUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, logoUrl: e.target.value }))} placeholder="https://…" />
          </Field>
          <Field label="Primary colour" hint="Hex, e.g. #1fae54. Used for the sidebar icon background.">
            <Input value={draft.primaryColorHex ?? ""} onChange={(e) => setDraft((d) => ({ ...d, primaryColorHex: e.target.value }))} placeholder="#1fae54" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="AC charger licenses" hint="Blank/0 = unlimited.">
              <Input
                type="number" min={0}
                value={draft.acLicenseTotal ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, acLicenseTotal: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </Field>
            <Field label="DC charger licenses" hint="Blank/0 = unlimited.">
              <Input
                type="number" min={0}
                value={draft.dcLicenseTotal ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, dcLicenseTotal: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </Field>
          </div>
          <Field label="Custom domain" hint="Stored for reference — DNS/SSL routing to this domain isn't set up yet.">
            <Input value={draft.customDomain ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customDomain: e.target.value }))} placeholder="app.acme-ev.com" />
          </Field>

          <div className="border-t border-ink-100 pt-4">
            <p className="label">Payment gateway</p>
            <p className="mt-1 text-xs text-ink-500">
              When set, this tenant's EMSP users/corporate accounts (whose profile has orgId set to this
              organisation) top up their wallet through this Razorpay account instead of the platform's.
              Leave both blank to keep using the platform account.
            </p>
            <Field label="Razorpay Key ID" className="mt-3">
              <Input value={draft.razorpayKeyId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, razorpayKeyId: e.target.value }))} placeholder="rzp_live_…" />
            </Field>
            {editing && (
              <Field label="Razorpay Key Secret" hint="Write-only — never shown back once saved. Leave blank and save to clear it (reverts this tenant to the platform account).">
                <div className="flex gap-2">
                  <Input type="password" value={keySecretInput} onChange={(e) => setKeySecretInput(e.target.value)} placeholder="•••••••••••••••" className="flex-1" />
                  <Button loading={secretBusy} onClick={() => void submitKeySecret()}>Save secret</Button>
                </div>
              </Field>
            )}
            {!editing && (
              <p className="mt-2 text-xs text-ink-400">Save this organisation first, then set its key secret.</p>
            )}
          </div>

          <div className="border-t border-ink-100 pt-4">
            <p className="label">Alpha platform tenant key</p>
            <p className="mt-1 text-xs text-ink-500">
              The API key the Alpha super admin (see ../../platform/) issued when onboarding this org as a
              tenant — scopes this org's team to whatever features its plan enables. Leave unset to enable
              everything (a standalone deploy, or an org not yet onboarded onto the platform).
            </p>
            {editing ? (
              <Field label="Tenant API key" className="mt-3" hint="Write-only — never shown back once saved. Leave blank and save to clear it.">
                <div className="flex gap-2">
                  <Input type="password" value={platformKeyInput} onChange={(e) => setPlatformKeyInput(e.target.value)} placeholder="tk_…" className="flex-1" />
                  <Button loading={platformKeyBusy} onClick={() => void submitPlatformKey()}>Save key</Button>
                </div>
              </Field>
            ) : (
              <p className="mt-2 text-xs text-ink-400">Save this organisation first, then set its platform key.</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
