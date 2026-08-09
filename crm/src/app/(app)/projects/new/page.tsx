"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Building2, Search, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ChargerConfigurator } from "@/components/charger-configurator";
import {
  Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea,
  useAsyncAction, useToast,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import {
  INDIAN_STATES, LAND_TYPES, LAND_TYPE_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL,
  LOCATION_TYPES, LOCATION_TYPE_LABEL, OWNER_TYPES, OWNER_TYPE_LABEL,
  type LandType, type LeadType, type LocationType, type OwnerType,
  type ProjectOwnership,
} from "@/lib/constants";
import { convertLeadToProject, createProject } from "@/lib/db/projects";
import { findConvertibleLeads } from "@/lib/db/leads";
import type { ConfigItem, ExtraItem } from "@/lib/pricing";
import type { Lead } from "@/lib/types";
import { cn, formatCompactINR, parseMapsLink } from "@/lib/utils";

function NewProjectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor, profile } = useAuth();
  const { users } = useAgents();
  const { push } = useToast();

  const initialOwnership = params.get("ownership") as ProjectOwnership | null;
  const initialType: LeadType = initialOwnership === "COCO" ? "CORPORATE" : "FRANCHISE";

  const [projectType, setProjectType] = useState<LeadType>(initialType);
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
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const { busy: converting, run: runConvert } = useAsyncAction();

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await findConvertibleLeads(leadSearch);
        if (!cancelled) setLeadResults(rows);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [leadSearch]);

  async function startFromLead(lead: Lead) {
    if (!actor) return;
    await runConvert(async () => {
      const project = await convertLeadToProject(lead, actor);
      router.replace(`/projects/${project.id}`);
    }, "Project created from lead.");
  }

  // Only an actual Franchise investor deal is investor-funded; every other
  // project type (RWA, Corporate, Government, Charger Sale, EPC, Software,
  // Others, Site) is Livanto building/operating directly.
  const ownership: ProjectOwnership = projectType === "FRANCHISE" ? "FRANCHISE" : "COCO";
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
    if (projectType === "FRANCHISE" && !client.name.trim()) {
      push("A franchise project needs the investor's name.", "error");
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
          client: client.name.trim() ? client : null,
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

      <Card
        title="Start from an existing lead"
        subtitle="Search any won lead — Franchise, RWA, EPC, Charger Sale, Corporate, Government, Software, Others, Site — to pre-fill everything below from it."
        className="mb-4"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder="Search by name, code, phone or city…"
            className="pl-9"
          />
        </div>
        {searching ? (
          <p className="py-4 text-center text-sm text-ink-500">Searching…</p>
        ) : leadResults.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">
            {leadSearch ? "No won, unconverted leads match." : "Type to search, or skip this and create a blank project below."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {leadResults.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{l.client?.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {l.code} · <Badge>{LEAD_TYPE_LABEL[l.type]}</Badge> · {l.client?.city} · {formatCompactINR(l.value ?? 0)}
                  </p>
                </div>
                <Button size="sm" variant="primary" loading={converting} onClick={() => void startFromLead(l)}>
                  Use this lead
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form onSubmit={submit} className="space-y-4">
        <Card
          title="Project type"
          subtitle="Same categories as Sales. A Franchise project is investor-funded; every other type is Livanto building/operating directly."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <Select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as LeadType)}
                options={LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))}
              />
            </Field>
            <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
              {ownership === "FRANCHISE" ? (
                <Zap className="h-4 w-4 shrink-0 text-brand-600" />
              ) : (
                <Building2 className="h-4 w-4 shrink-0 text-brand-600" />
              )}
              {ownership === "FRANCHISE"
                ? "Investor-funded — will show under Projects."
                : "Livanto-funded — will also show under Company Stations."}
            </div>
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

        <Card
          title={projectType === "FRANCHISE" ? "Franchisee" : "Client / contact"}
          subtitle={projectType === "FRANCHISE" ? undefined : "Optional — whoever you're dealing with, even on a Livanto-owned station."}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name" required={projectType === "FRANCHISE"}>
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
