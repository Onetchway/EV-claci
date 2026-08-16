"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  createOrganization, deleteOrganization, setOrganizationActive, subscribeOrganizations, updateOrganization,
  type OrganizationDraft,
} from "@/lib/db/organizations";
import { isSuperAdmin } from "@/lib/permissions";
import type { Organization } from "@/lib/types";

const blankDraft: OrganizationDraft = { name: "", logoUrl: "", primaryColorHex: "", customDomain: "" };

export default function OrganizationsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = isSuperAdmin(viewer.role);
  const { run, busy } = useAsyncAction();

  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [draft, setDraft] = useState<OrganizationDraft>(blankDraft);

  useEffect(() => subscribeOrganizations(setOrgs), []);

  function openNew() {
    setEditing(null);
    setDraft(blankDraft);
    setOpen(true);
  }

  function openEdit(o: Organization) {
    setEditing(o);
    setDraft({ name: o.name, logoUrl: o.logoUrl ?? "", primaryColorHex: o.primaryColorHex ?? "", customDomain: o.customDomain ?? "" });
    setOpen(true);
  }

  async function submit() {
    if (!actor || !draft.name.trim()) return;
    const clean: OrganizationDraft = {
      name: draft.name.trim(),
      logoUrl: draft.logoUrl?.trim() || undefined,
      primaryColorHex: draft.primaryColorHex?.trim() || undefined,
      customDomain: draft.customDomain?.trim() || undefined,
    };
    await run(async () => {
      if (editing) await updateOrganization(editing.id, clean);
      else await createOrganization(clean, actor);
      setOpen(false);
    }, editing ? "Organisation updated." : "Organisation created.");
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
                    style={{ backgroundColor: o.primaryColorHex || "#1cb567" }}
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                )}
                <Badge className={o.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                  {o.active ? "Active" : "Disabled"}
                </Badge>
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
          <Field label="Primary colour" hint="Hex, e.g. #1cb567. Used for the sidebar icon background.">
            <Input value={draft.primaryColorHex ?? ""} onChange={(e) => setDraft((d) => ({ ...d, primaryColorHex: e.target.value }))} placeholder="#1cb567" />
          </Field>
          <Field label="Custom domain" hint="Stored for reference — DNS/SSL routing to this domain isn't set up yet.">
            <Input value={draft.customDomain ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customDomain: e.target.value }))} placeholder="app.acme-ev.com" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
