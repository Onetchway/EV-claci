"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { SiteLocationFields } from "@/components/site-location-fields";
import {
  Button, Card, Field, Input, PageHeader, Select, Textarea, useAsyncAction,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { SOURCES, SOURCE_LABEL, type Source } from "@/lib/constants";
import { blankLocation, createSitePartner } from "@/lib/db/site-partners";
import { canManageSitePartners } from "@/lib/permissions";
import type { SiteLocation } from "@/lib/types";
import { isValidPhone } from "@/lib/utils";

export default function NewSitePartnerPage() {
  const router = useRouter();
  const { actor, profile } = useAuth();
  const viewer = useViewer();
  const { users } = useAgents();
  const { busy, run } = useAsyncAction();

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState<Source>("DIRECT_CALL");
  const [sourceDetail, setSourceDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerId, setOwnerId] = useState(profile?.uid ?? "");
  const [locations, setLocations] = useState<SiteLocation[]>([blankLocation()]);
  const [error, setError] = useState<string | null>(null);

  const ownerOptions = users.map((u) => ({ value: u.uid, label: `${u.name} (${u.role.replace("_", " ").toLowerCase()})` }));

  function patchLocation(id: string, patch: Partial<SiteLocation>) {
    setLocations((rows) => rows.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!contactName.trim()) { setError("Contact name is required."); return; }
    if (!isValidPhone(phone)) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (!ownerId) { setError("Assign this to an agent."); return; }
    const cleanLocations = locations.filter((l) => l.locationName?.trim());
    if (cleanLocations.length === 0) { setError("Add at least one location."); return; }

    const owner = users.find((u) => u.uid === ownerId);
    if (!actor) return;
    const { id } = await createSitePartner({
      contactName: contactName.trim(),
      phone,
      email: email.trim(),
      company: company.trim(),
      city: city.trim(),
      state: state.trim(),
      address: address.trim(),
      source,
      sourceDetail: sourceDetail.trim(),
      notes: notes.trim(),
      ownerId,
      ownerName: owner?.name ?? actor.name,
      locations: cleanLocations,
    }, actor);
    router.push(`/site-enquiries/${id}`);
  }

  if (!canManageSitePartners(viewer)) {
    return <p className="text-sm text-ink-500">You don't have permission to add site partners.</p>;
  }

  return (
    <>
      <PageHeader
        title="New site partner"
        description="A person or company offering one or more locations for a charging station."
      />

      <div className="space-y-4">
        <Card title="Contact details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contact name" required>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Field>
            <Field label="Phone" required>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Company" hint="e.g. BSES — when one company offers several locations at once.">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="State">
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Source">
              <Select value={source} onChange={(e) => setSource(e.target.value as Source)} options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
            </Field>
            <Field label="Source detail">
              <Input value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} />
            </Field>
            <Field label="Assigned to" required>
              <Select placeholder="Select an agent" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={ownerOptions} />
            </Field>
            <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card
          title="Locations"
          subtitle="Add every location this partner is offering — no need for a separate record per location."
          actions={<Button size="sm" onClick={() => setLocations((rows) => [...rows, blankLocation()])}><Plus className="h-3.5 w-3.5" /> Add another location</Button>}
        >
          <div className="space-y-3">
            {locations.map((loc, i) => (
              <SiteLocationFields
                key={loc.id}
                index={i}
                value={loc}
                onChange={(patch) => patchLocation(loc.id, patch)}
                onRemove={locations.length > 1 ? () => setLocations((rows) => rows.filter((l) => l.id !== loc.id)) : undefined}
              />
            ))}
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">{error}</p>
        )}

        <Button variant="primary" loading={busy} onClick={() => void run(submit)}>Create site partner</Button>
      </div>
    </>
  );
}
