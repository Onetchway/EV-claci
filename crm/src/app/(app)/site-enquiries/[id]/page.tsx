"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { SiteLocationFields } from "@/components/site-location-fields";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { SOURCES, SOURCE_LABEL, type Source } from "@/lib/constants";
import {
  addLocation, blankLocation, deleteSitePartner, removeLocation, subscribeSitePartner,
  updateLocation, updateSitePartner,
} from "@/lib/db/site-partners";
import { canManageSitePartners } from "@/lib/permissions";
import type { SiteLocation, SitePartner } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function SitePartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { users } = useAgents();
  const { busy, run } = useAsyncAction();

  const [partner, setPartner] = useState<SitePartner | null | undefined>(undefined);
  const [editingInfo, setEditingInfo] = useState(false);
  const [form, setForm] = useState<Partial<SitePartner>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newLocation, setNewLocation] = useState<SiteLocation | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState<SiteLocation | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SiteLocation | null>(null);

  useEffect(() => subscribeSitePartner(id, setPartner), [id]);
  useDocumentTitle(partner ? partner.code : undefined);

  const canEdit = canManageSitePartners(viewer);
  const ownerOptions = users.map((u) => ({ value: u.uid, label: `${u.name} (${u.role.replace("_", " ").toLowerCase()})` }));

  function startEditInfo() {
    if (!partner) return;
    setForm({
      contactName: partner.contactName, phone: partner.phone, email: partner.email,
      company: partner.company, city: partner.city, state: partner.state, address: partner.address,
      source: partner.source, sourceDetail: partner.sourceDetail, notes: partner.notes,
      status: partner.status, ownerId: partner.ownerId, ownerName: partner.ownerName,
    });
    setEditingInfo(true);
  }

  async function saveInfo() {
    if (!partner || !actor) return;
    const owner = users.find((u) => u.uid === form.ownerId);
    await updateSitePartner(partner.id, { ...form, ownerName: owner?.name ?? form.ownerName }, actor);
    setEditingInfo(false);
  }

  function startEditLocation(loc: SiteLocation) {
    setEditingLocationId(loc.id);
    setLocationDraft(loc);
  }

  async function saveLocation() {
    if (!partner || !actor || !locationDraft) return;
    await updateLocation(partner, locationDraft, actor);
    setEditingLocationId(null);
    setLocationDraft(null);
  }

  async function saveNewLocation() {
    if (!partner || !actor || !newLocation) return;
    if (!newLocation.locationName?.trim()) throw new Error("Location name is required.");
    await addLocation(partner, newLocation, actor);
    setNewLocation(null);
  }

  if (partner === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (!partner) {
    return <EmptyState title="Site partner not found" action={<Link href="/site-enquiries"><Button>Back to site enquiries</Button></Link>} />;
  }

  return (
    <>
      <PageHeader
        title={`${partner.contactName}${partner.company ? ` — ${partner.company}` : ""}`}
        description={`${partner.code} · ${partner.phone}`}
        actions={
          <>
            <Badge className={partner.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
              {partner.status}
            </Badge>
            {canEdit && <Button onClick={startEditInfo}>Edit</Button>}
            {canEdit && (
              <Button onClick={() => setDeleteOpen(true)} className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Contact details" className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Phone</dt><dd className="mt-0.5 text-sm">{partner.phone}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Email</dt><dd className="mt-0.5 text-sm">{partner.email || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">City</dt><dd className="mt-0.5 text-sm">{partner.city || "—"}{partner.state ? `, ${partner.state}` : ""}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Source</dt><dd className="mt-0.5 text-sm">{SOURCE_LABEL[partner.source]}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">Address</dt><dd className="mt-0.5 text-sm">{partner.address || "—"}</dd></div>
            {partner.notes && (
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">Notes</dt><dd className="mt-0.5 text-sm">{partner.notes}</dd></div>
            )}
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Assigned to</dt><dd className="mt-0.5 text-sm">{partner.ownerName}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Created</dt><dd className="mt-0.5 text-sm">{formatDateTime(partner.createdAt)}</dd></div>
          </dl>
        </Card>

        <Card title="Summary">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Locations offered</dt>
              <dd className="text-lg font-semibold">{partner.locations.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Available</dt>
              <dd className="text-lg font-semibold text-emerald-600">{partner.locations.filter((l) => l.status === "AVAILABLE").length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Mapped to a lead</dt>
              <dd className="text-lg font-semibold text-sky-600">{partner.locations.filter((l) => l.status === "MAPPED").length}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card
        title="Locations"
        subtitle={`${partner.locations.length} location${partner.locations.length === 1 ? "" : "s"} offered by this partner.`}
        className="mt-4"
        actions={canEdit && <Button size="sm" onClick={() => setNewLocation(blankLocation())}><Plus className="h-3.5 w-3.5" /> Add location</Button>}
      >
        {partner.locations.length === 0 ? (
          <EmptyState title="No locations added yet" action={canEdit ? <Button variant="primary" onClick={() => setNewLocation(blankLocation())}><Plus className="h-4 w-4" /> Add location</Button> : undefined} />
        ) : (
          <div className="space-y-3">
            {partner.locations.map((loc, i) => (
              editingLocationId === loc.id && locationDraft ? (
                <div key={loc.id} className="space-y-2">
                  <SiteLocationFields index={i} value={locationDraft} onChange={(patch) => setLocationDraft({ ...locationDraft, ...patch })} />
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => { setEditingLocationId(null); setLocationDraft(null); }}>Cancel</Button>
                    <Button variant="primary" loading={busy} onClick={() => void run(saveLocation, "Location updated.")}>Save location</Button>
                  </div>
                </div>
              ) : (
                <div key={loc.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      {loc.locationName || "Unnamed location"}
                      <Badge className={
                        loc.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : loc.status === "MAPPED" ? "bg-sky-100 text-sky-800 ring-sky-200"
                            : "bg-rose-100 text-rose-800 ring-rose-200"
                      }
                      >
                        {loc.status === "MAPPED" ? `Mapped · ${loc.linkedLeadCode ?? ""}` : loc.status}
                      </Badge>
                    </p>
                    {loc.address && <p className="mt-1 text-xs text-ink-600">{loc.address}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                      {loc.mapsLink && (
                        <a href={loc.mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                          Open in Maps <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {loc.compensationType && (
                        <span>{loc.compensationType === "RENTAL" ? `₹${loc.compensationAmount ?? 0}/month` : `${loc.compensationAmount ?? 0}% revenue share`}</span>
                      )}
                      {loc.powerLoad && <span>{loc.powerLoad.replace("_", " ")}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" onClick={() => startEditLocation(loc)}>Edit</Button>
                      {loc.status === "AVAILABLE" && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(loc)}
                          className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${loc.locationName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={newLocation !== null}
        onClose={() => setNewLocation(null)}
        title="Add a location"
        footer={
          <>
            <Button onClick={() => setNewLocation(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(saveNewLocation, "Location added.")}>Add location</Button>
          </>
        }
      >
        {newLocation && <SiteLocationFields value={newLocation} onChange={(patch) => setNewLocation({ ...newLocation, ...patch })} />}
      </Modal>

      <Modal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove this location?"
        description="This removes the location from the partner's list. It cannot be recovered."
        footer={
          <>
            <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!removeTarget || !actor) return;
                  await removeLocation(partner, removeTarget.id, actor);
                  setRemoveTarget(null);
                }, "Location removed.")
              }
            >
              <Trash2 className="h-4 w-4" /> Remove location
            </Button>
          </>
        }
      >
        {removeTarget && <p className="text-sm text-ink-700">{removeTarget.locationName}</p>}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this site partner?"
        description="This permanently removes the partner and every location listed under them. It cannot be recovered."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await deleteSitePartner(partner);
                  router.push("/site-enquiries");
                }, "Site partner deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete site partner
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{partner.contactName} ({partner.code}) — {partner.locations.length} location{partner.locations.length === 1 ? "" : "s"}</p>
      </Modal>

      <Modal
        open={editingInfo}
        onClose={() => setEditingInfo(false)}
        title="Edit site partner"
        footer={
          <>
            <Button onClick={() => setEditingInfo(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(saveInfo, "Site partner updated.")}>Save changes</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name" required className="sm:col-span-2">
            <Input value={form.contactName ?? ""} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Company">
            <Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </Field>
          <Field label="City">
            <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="State">
            <Input value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="Source">
            <Select value={form.source ?? "DIRECT_CALL"} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as Source }))} options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
          </Field>
          <Field label="Status">
            <Select
              value={form.status ?? "ACTIVE"}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SitePartner["status"] }))}
              options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
            />
          </Field>
          <Field label="Assigned to" className="sm:col-span-2">
            <Select value={form.ownerId ?? ""} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))} options={ownerOptions} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
