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

const blankDraft: OrganizationDraft = { name: "", logoUrl: "", primaryColorHex: "", customDomain: "", acLicenseTotal: undefined, dcLicenseTotal: undefined, razorpayKeyId: "" };

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
      name: o.name, logoUrl: o.logoUrl ?? "", primaryColorHex: o.primaryColorHex ?? "", customDomain: o.customDomain ?? "",
      acLicenseTotal: o.acLicenseTotal, dcLicenseTotal: o.dcLicenseTotal, razorpayKeyId: o.razorpayKeyId ?? "",
    });
    setKeySecretInput("");
    setOpen(true);
  }

  async function submit() {
    if (!actor || !draft.name.trim()) return;
    const clean: OrganizationDraft = {
      name: draft.name.trim(),
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

  if (!canManage) {
    return <EmptyState title="Super admins only" description="Organisation (white-label) management is restricted to super admins." />;
  }

  return (
    <>
      <PageHeader
        title="Organisations (White Label)"
        description="Tenant registry for white-labelling this CRM. Foundation only, by design: branding (logo/colour/domain) is stored per organisation and applied to the sidebar for team members assigned to one, but no other data (leads, chargers, sessions, etc.) is isolated between organisations yet — that's a separate, larger migration."
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
        </div>
      </Modal>
    </>
  );
}
