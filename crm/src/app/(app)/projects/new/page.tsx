"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Building2, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ChargerConfigurator } from "@/components/charger-configurator";
import {
  Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea, useToast,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import {
  INDIAN_STATES, LAND_TYPES, LAND_TYPE_LABEL, LOCATION_TYPES, LOCATION_TYPE_LABEL,
  OWNER_TYPES, OWNER_TYPE_LABEL, PROJECT_OWNERSHIPS, PROJECT_OWNERSHIP_LABEL,
  type LandType, type LocationType, type OwnerType, type ProjectOwnership,
} from "@/lib/constants";
import { createProject } from "@/lib/db/projects";
import type { ConfigItem, ExtraItem } from "@/lib/pricing";
import { cn, parseMapsLink } from "@/lib/utils";

function NewProjectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor, profile } = useAuth();
  const { users } = useAgents();
  const { push } = useToast();

  const initialOwnership = (params.get("ownership") as ProjectOwnership | null) ?? "COCO";

  const [ownership, setOwnership] = useState<ProjectOwnership>(initialOwnership);
  const [name, setName] = useState("");
  const [client, setClient] = useState({ name: "", phone: "", email: "", company: "" });
  const [site, setSite] = useState({
    locationName: "",
    address: "",
    city: "",
    state: "",
    mapsLink: "",
    locationTypes: [] as LocationType[],
    landType: null as LandType | null,
    ownerType: null as OwnerType | null,
    spaceAvailableSqft: null as number | null,
  });
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [managerId, setManagerId] = useState(profile?.uid ?? "");
  const [capexBudget, setCapexBudget] = useState<number | null>(null);
  const [targetLiveAt, setTargetLiveAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isCoco = ownership === "COCO";

  function toggleLocationType(t: LocationType) {
    setSite((s) => ({
      ...s,
      locationTypes: s.locationTypes.includes(t)
        ? s.locationTypes.filter((x) => x !== t)
        : [...s.locationTypes, t],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!actor) return;
    if (!name.trim()) { push("Give the project a name.", "error"); return; }
    if (!site.city.trim()) { push("City is required.", "error"); return; }
    if (!isCoco && !client.name.trim()) {
      push("A franchise project needs the franchisee's name.", "error");
      return;
    }

    setBusy(true);
    try {
      const coords = parseMapsLink(site.mapsLink);
      const manager = users.find((u) => u.uid === managerId);
      const project = await createProject(
        {
          ownership,
          name: name.trim(),
          client: isCoco ? null : client,
          site: { ...site, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
          config,
          extras,
          discount,
          managerId: managerId || actor.uid,
          managerName: manager?.name ?? actor.name,
          capexBudget,
          targetLiveAt: targetLiveAt ? new Date(`${targetLiveAt}T00:00:00`) : null,
          note,
        },
        actor,
      );
      push(`Project ${project.code} created.`, "success");
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      push((err as Error).message || "Could not create the project.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New project"
        description="Track delivery of a station from site survey through to commissioning."
      />

      <form onSubmit={submit} className="space-y-4">
        <Card title="Ownership" subtitle="Who funds and owns this station.">
          <div className="grid gap-2 sm:grid-cols-2">
            {PROJECT_OWNERSHIPS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwnership(o)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                  ownership === o
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                    : "border-ink-200 bg-white hover:border-ink-300",
                )}
              >
                {o === "COCO" ? (
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                ) : (
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                )}
                <span>
                  <span className="block text-sm font-semibold text-ink-900">
                    {PROJECT_OWNERSHIP_LABEL[o]}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {o === "COCO"
                      ? "Livanto funds, owns and operates the station."
                      : "An investor funds it; Livanto builds and operates it."}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Project">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Project name" required className="sm:col-span-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shreeji CNG Station, Najafgarh"
              />
            </Field>
            <Field label="Project manager">
              <Select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                options={users.map((u) => ({ value: u.uid, label: u.name }))}
              />
            </Field>
            {isCoco && (
              <Field label="CAPEX budget (₹)" hint="Defaults to the bill of materials total.">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={capexBudget ?? ""}
                  onChange={(e) => setCapexBudget(e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
            )}
            <Field label="Target live date">
              <Input type="date" value={targetLiveAt} onChange={(e) => setTargetLiveAt(e.target.value)} />
            </Field>
            <Field label="Note" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Card>

        {!isCoco && (
          <Card title="Franchisee">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Name" required>
                <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </Field>
              <Field label="Company">
                <Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} />
              </Field>
            </div>
          </Card>
        )}

        <Card title="Site">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Location name">
              <Input
                value={site.locationName}
                onChange={(e) => setSite({ ...site, locationName: e.target.value })}
              />
            </Field>
            <Field label="City" required>
              <Input value={site.city} onChange={(e) => setSite({ ...site, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Select
                placeholder="Select state"
                value={site.state}
                onChange={(e) => setSite({ ...site, state: e.target.value })}
                options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <Field label="Google Maps link" className="sm:col-span-2">
              <Input value={site.mapsLink} onChange={(e) => setSite({ ...site, mapsLink: e.target.value })} />
            </Field>
            <Field label="Space available (sq.ft)">
              <Input
                type="number"
                min={0}
                value={site.spaceAvailableSqft ?? ""}
                onChange={(e) =>
                  setSite({ ...site, spaceAvailableSqft: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Land type">
              <Select
                placeholder="Select"
                value={site.landType ?? ""}
                onChange={(e) => setSite({ ...site, landType: (e.target.value || null) as LandType | null })}
                options={LAND_TYPES.map((l) => ({ value: l, label: LAND_TYPE_LABEL[l] }))}
              />
            </Field>
            <Field label="Owner type">
              <Select
                placeholder="Select"
                value={site.ownerType ?? ""}
                onChange={(e) => setSite({ ...site, ownerType: (e.target.value || null) as OwnerType | null })}
                options={OWNER_TYPES.map((o) => ({ value: o, label: OWNER_TYPE_LABEL[o] }))}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={2} value={site.address} onChange={(e) => setSite({ ...site, address: e.target.value })} />
            </Field>
            <Field label="Location type" className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_TYPES.map((t) => {
                  const on = site.locationTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleLocationType(t)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                        on
                          ? "bg-brand-600 text-white ring-brand-600"
                          : "bg-white text-ink-600 ring-ink-300 hover:bg-ink-50",
                      )}
                    >
                      {LOCATION_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Bill of materials" subtitle="Chargers and everything billed alongside them.">
          <ChargerConfigurator
            value={config}
            onChange={setConfig}
            extras={extras}
            onExtrasChange={setExtras}
            discount={discount}
            onDiscountChange={setDiscount}
            allowDiscount
            allowPriceOverride
          />
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Create project</Button>
        </div>
      </form>
    </>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewProjectInner />
    </Suspense>
  );
}
