"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MapPin } from "lucide-react";

import { ChargerConfigurator } from "@/components/charger-configurator";
import { useAuth } from "@/components/auth-provider";
import {
  Button, Card, Checkbox, Field, Input, Modal, Select, Textarea, useToast,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { useSettings } from "@/hooks/use-settings";
import {
  BANKS, CHARGER_OEMS, CLIENT_ENTITY_TYPE_LABEL, CLIENT_ENTITY_TYPES,
  commercialModelLabel, COMMERCIAL_MODELS,
  COMMERCIAL_MODEL_TYPES, FUNDING_MODES, FUNDING_MODE_LABEL, INDIAN_STATES,
  LAND_TYPES, LAND_TYPE_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL,
  locationProviderLabel, LOCATION_PROVIDERS, LOCATION_TYPES,
  LOCATION_TYPE_LABEL, OWNERSHIP_LABEL, OWNERSHIP_TYPES, OWNER_TYPES,
  OWNER_TYPE_LABEL, POWER_LOADS, POWER_LOAD_LABEL,
  SITE_COMPENSATION_TYPE_LABEL, SITE_COMPENSATION_TYPES, SOURCES, SOURCE_LABEL,
  TYPES_WITHOUT_CHARGERS, TYPES_WITHOUT_FINANCING,
  type ClientEntityType, type CommercialModel, type FundingMode,
  type LandType, type LeadType, type LocationProvider, type LocationType,
  type Ownership, type OwnerType, type PowerLoad,
  type SiteCompensationType, type Source,
} from "@/lib/constants";
import { DEFAULT_FINANCING, findDuplicateLeads } from "@/lib/db/leads";
import { subscribePartners } from "@/lib/db/partners";
import { markLocationMapped, searchAvailableLocations, type LocationSearchResult } from "@/lib/db/site-partners";
import { canApplyDiscount, canOverridePrice, canReassign } from "@/lib/permissions";
import { buildQuote, type ConfigItem, type ExtraItem } from "@/lib/pricing";
import type { ClientInfo, FinancingInfo, Lead, SiteInfo } from "@/lib/types";
import {
  cn, formatINR, isValidEmail, isValidPan, isValidPhone, normalisePhone, parseMapsLink, toDate,
} from "@/lib/utils";

export interface LeadFormValues {
  type: LeadType;
  client: ClientInfo;
  source: Source;
  sourceDetail: string;
  config: ConfigItem[];
  extras: ExtraItem[];
  discount: number;
  oem: string | null;
  financing: FinancingInfo;
  site: SiteInfo;
  tags: string[];
  nextFollowUpAt: Date | null;
  expectedCloseAt: Date | null;
  partnerId: string | null;
  partnerName: string | null;
  commercialModel: CommercialModel | null;
  ownerId: string;
  ownerName: string;
}

const emptyValues = (ownerId: string, ownerName: string): LeadFormValues => ({
  type: "FRANCHISE",
  client: { name: "", phone: "", altPhone: "", email: "", company: "", city: "", state: "", address: "", pan: "", gstin: "" },
  source: "DIRECT_CALL",
  sourceDetail: "",
  config: [],
  extras: [],
  discount: 0,
  oem: null,
  financing: { ...DEFAULT_FINANCING },
  site: { locationName: "", mapsLink: "", locationTypes: [], ownership: null, commercialModelInterested: false, powerLoad: null, sanctionedLoadKva: null, spaceAvailableSqft: null, nearbyLandmark: "", remarks: "" },
  tags: [],
  nextFollowUpAt: null,
  expectedCloseAt: null,
  partnerId: null,
  partnerName: null,
  commercialModel: null,
  ownerId,
  ownerName,
});

export function leadToFormValues(lead: Lead): LeadFormValues {
  return {
    type: lead.type,
    // Optional fields default to "" so the inputs stay controlled; the
    // required ones always come from the stored lead.
    client: {
      altPhone: "", email: "", company: "", state: "", address: "", pan: "", gstin: "",
      ...lead.client,
    },
    source: lead.source,
    sourceDetail: lead.sourceDetail ?? "",
    config: lead.config ?? [],
    extras: lead.extras ?? [],
    discount: lead.discount ?? 0,
    oem: lead.oem ?? null,
    financing: lead.financing ?? { ...DEFAULT_FINANCING },
    site: {
      locationName: "", mapsLink: "", locationTypes: [], ownership: null,
      commercialModelInterested: false, powerLoad: null, sanctionedLoadKva: null,
      spaceAvailableSqft: null, nearbyLandmark: "", remarks: "", ...lead.site,
    },
    tags: lead.tags ?? [],
    nextFollowUpAt: toDate(lead.nextFollowUpAt),
    expectedCloseAt: toDate(lead.expectedCloseAt),
    partnerId: lead.partnerId ?? null,
    partnerName: lead.partnerName ?? null,
    commercialModel: lead.commercialModel ?? null,
    ownerId: lead.ownerId,
    ownerName: lead.ownerName,
  };
}

const toInputDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const fromInputDate = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);

type Errors = Partial<Record<string, string>>;

export function validate(v: LeadFormValues): Errors {
  const e: Errors = {};
  if (!v.client.name.trim()) e["client.name"] = "Client name is required.";
  if (!isValidPhone(v.client.phone)) e["client.phone"] = "Enter a valid 10-digit Indian mobile number.";
  if (v.client.altPhone && !isValidPhone(v.client.altPhone)) e["client.altPhone"] = "Enter a valid 10-digit number.";
  if (!isValidEmail(v.client.email ?? "")) e["client.email"] = "Enter a valid email address.";
  if (!isValidPan(v.client.pan ?? "")) e["client.pan"] = "PAN must look like ABCDE1234F.";
  if (!v.client.city.trim()) e["client.city"] = "City is required.";
  if (!v.ownerId) e.ownerId = "Assign the lead to an agent.";
  if (v.type === "SITE" && !v.site.locationName?.trim()) {
    e["site.locationName"] = "Location name is required for a site enquiry.";
  }
  return e;
}

interface Props {
  initial?: LeadFormValues;
  submitLabel: string;
  /** May return the saved lead's id/code — used to mark a mapped Site Partner location as no longer available. */
  onSubmit: (values: LeadFormValues) => Promise<{ id: string; code: string } | void>;
  onCancel?: () => void;
  /** Existing lead id, so the duplicate check can ignore itself. */
  currentLeadId?: string;
}

export function LeadForm({ initial, submitLabel, onSubmit, onCancel, currentLeadId }: Props) {
  const { profile, role } = useAuth();
  const { users } = useAgents();
  const { push } = useToast();
  const { settings } = useSettings();

  const [values, setValues] = useState<LeadFormValues>(
    () => initial ?? emptyValues(profile?.uid ?? "", profile?.name ?? ""),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Lead[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [fundingInputMode, setFundingInputMode] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [siteMapOpen, setSiteMapOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");
  const [siteCandidates, setSiteCandidates] = useState<LocationSearchResult[]>([]);
  const [siteSearching, setSiteSearching] = useState(false);
  const [pendingLocationRef, setPendingLocationRef] = useState<{ partnerId: string; locationId: string } | null>(null);

  const viewer = useMemo(
    () => ({ uid: profile?.uid ?? "", role: role ?? "AGENT" as const }),
    [profile, role],
  );

  const showChargers = !TYPES_WITHOUT_CHARGERS.includes(values.type);
  /** RWA/Corporate/Government leads represent an institution, not an individual — the "client" fields are the POC on behalf of a society/organization that's always effectively a "firm" (company/PAN/GST relevant), so there's no Individual/Firm toggle to show. */
  const isInstitutional = values.type === "RWA" || values.type === "CORPORATE" || values.type === "GOVERNMENT";
  const showSiteDetails = values.type === "SITE" || values.type === "FRANCHISE" || isInstitutional;

  /** Same total the Charger configuration card below shows as "Total investment" — recomputed here too so the funding % option has something to work off before that card even renders (and stays in sync as it's edited). */
  const totalInvestment = useMemo(
    () => buildQuote(values.config, { discount: values.discount, extras: values.extras }).grandTotal,
    [values.config, values.discount, values.extras],
  );

  const set = <K extends keyof LeadFormValues>(key: K, val: LeadFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const setClient = (patch: Partial<ClientInfo>) =>
    setValues((v) => ({ ...v, client: { ...v.client, ...patch } }));

  const setSite = (patch: Partial<SiteInfo>) =>
    setValues((v) => ({ ...v, site: { ...v.site, ...patch } }));

  // Warn about an existing lead on the same phone, email or GSTIN rather than
  // silently creating a second one that two agents then both chase.
  useEffect(() => {
    const phone = normalisePhone(values.client.phone);
    const email = values.client.email?.trim() ?? "";
    const gstin = values.client.gstin?.trim() ?? "";
    if (phone.length !== 10 && email.length < 5 && gstin.length < 4) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const found = await findDuplicateLeads({ phone, email, gstin, excludeId: currentLeadId });
        if (!cancelled) setDuplicates(found);
      } catch {
        /* the duplicate hint is advisory; rule denials must not block the form */
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [values.client.phone, values.client.email, values.client.gstin, currentLeadId]);

  const [partners, setPartners] = useState<{ id: string; code: string; name: string }[]>([]);
  useEffect(() => subscribePartners((rows) => setPartners(rows.filter((p) => p.status === "ACTIVE"))), []);

  // Site Partner location search for the "map an existing location" picker below.
  useEffect(() => {
    if (!siteMapOpen) return;
    let cancelled = false;
    setSiteSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchAvailableLocations(siteSearch);
        if (!cancelled) setSiteCandidates(rows);
      } catch {
        /* advisory only */
      } finally {
        if (!cancelled) setSiteSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [siteMapOpen, siteSearch]);

  const ownerOptions = users.map((u) => ({ value: u.uid, label: `${u.name} (${u.role.replace("_", " ").toLowerCase()})` }));

  function toggleLocationType(t: LocationType) {
    const current = values.site.locationTypes ?? [];
    setSite({
      locationTypes: current.includes(t) ? current.filter((x) => x !== t) : [...current, t],
    });
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || values.tags.includes(t)) { setTagInput(""); return; }
    set("tags", [...values.tags, t]);
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      push("Fix the highlighted fields before saving.", "error");
      return;
    }

    setBusy(true);
    try {
      const coords = parseMapsLink(values.site.mapsLink ?? "");
      const saved = await onSubmit({
        ...values,
        client: { ...values.client, phone: normalisePhone(values.client.phone), pan: values.client.pan?.toUpperCase() ?? "" },
        site: { ...values.site, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      });
      if (saved && pendingLocationRef) {
        markLocationMapped(pendingLocationRef.partnerId, pendingLocationRef.locationId, saved).catch(() => {
          /* the lead itself saved fine; a failed mark-as-mapped isn't worth surfacing as an error */
        });
      }
    } catch (err) {
      push((err as Error).message || "Could not save the lead.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Lead type" subtitle={`What this contact actually wants from ${settings.company.shortName || "us"}.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <Select
              value={values.type}
              onChange={(e) => set("type", e.target.value as LeadType)}
              // Site/Location Partner leads moved to their own Site Enquiries
              // section (which can hold several locations per partner) — no
              // longer offered here, except to keep editing one that
              // predates the change.
              options={LEAD_TYPES
                .filter((t) => t !== "SITE" || initial?.type === "SITE")
                .map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))}
            />
          </Field>
          {COMMERCIAL_MODEL_TYPES.includes(values.type) && (
            <Field label="Commercial model" hint="How they pay for the installation.">
              <Select
                value={values.commercialModel ?? ""}
                onChange={(e) => set("commercialModel", (e.target.value || null) as CommercialModel | null)}
                placeholder="Select a model"
                options={COMMERCIAL_MODELS.map((m) => ({ value: m, label: commercialModelLabel(m, settings.company.shortName) }))}
              />
            </Field>
          )}
        </div>
      </Card>

      <Card title={isInstitutional ? "Organization details" : "Client details"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={isInstitutional ? "POC name" : "Client name"} required error={errors["client.name"]}>
            <Input value={values.client.name} onChange={(e) => setClient({ name: e.target.value })} placeholder="Shoyeb Khan" />
          </Field>
          <Field label="Salutation" hint="Drives EOI/Agreement wording — not guessed from the name.">
            <Select
              placeholder="Select"
              value={values.client.salutation ?? ""}
              onChange={(e) => setClient({ salutation: (e.target.value || undefined) as ClientInfo["salutation"] })}
              options={[
                { value: "Mr.", label: "Mr." },
                { value: "Ms.", label: "Ms." },
                { value: "Mrs.", label: "Mrs." },
                { value: "M/s", label: "M/s (firm)" },
              ]}
            />
          </Field>
          <Field label="Phone number" required error={errors["client.phone"]}>
            <Input
              inputMode="numeric"
              value={values.client.phone}
              onChange={(e) => setClient({ phone: e.target.value })}
              placeholder="7028297300"
            />
          </Field>
          <Field label="Alternate phone" error={errors["client.altPhone"]}>
            <Input inputMode="numeric" value={values.client.altPhone ?? ""} onChange={(e) => setClient({ altPhone: e.target.value })} />
          </Field>
          <Field label="Email" error={errors["client.email"]}>
            <Input type="email" value={values.client.email ?? ""} onChange={(e) => setClient({ email: e.target.value })} />
          </Field>
          <Field label="City" required error={errors["client.city"]}>
            <Input value={values.client.city} onChange={(e) => setClient({ city: e.target.value })} placeholder="Vayusena Nagar" />
          </Field>
          <Field label="State">
            <Select
              placeholder="Select state"
              value={values.client.state ?? ""}
              onChange={(e) => setClient({ state: e.target.value })}
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2 lg:col-span-3">
            <Textarea value={values.client.address ?? ""} onChange={(e) => setClient({ address: e.target.value })} rows={2} />
          </Field>

          {isInstitutional ? (
            <Field label={values.type === "RWA" ? "Society name" : "Organization name"} required className="sm:col-span-2 lg:col-span-3">
              <Input value={values.client.company ?? ""} onChange={(e) => setClient({ company: e.target.value })} />
            </Field>
          ) : (
            <Field label="Client type" className="sm:col-span-2 lg:col-span-3">
              <Select
                value={values.client.entityType ?? "INDIVIDUAL"}
                onChange={(e) => setClient({ entityType: e.target.value as ClientEntityType })}
                options={CLIENT_ENTITY_TYPES.map((t) => ({ value: t, label: CLIENT_ENTITY_TYPE_LABEL[t] }))}
              />
            </Field>
          )}

          {(isInstitutional || values.client.entityType === "FIRM") && (
            <>
              {!isInstitutional && (
                <Field label="Company / firm name" className="sm:col-span-2 lg:col-span-3">
                  <Input value={values.client.company ?? ""} onChange={(e) => setClient({ company: e.target.value })} />
                </Field>
              )}
              <Field label="PAN" error={errors["client.pan"]} hint="Format-checked only — not verified against Income Tax records.">
                <div className="relative">
                  <Input
                    value={values.client.pan ?? ""}
                    onChange={(e) => setClient({ pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="pr-24"
                  />
                  {values.client.pan && (
                    <span
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        isValidPan(values.client.pan)
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {isValidPan(values.client.pan) ? "Valid format" : "Check format"}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="GSTIN">
                <Input value={values.client.gstin ?? ""} onChange={(e) => setClient({ gstin: e.target.value.toUpperCase() })} maxLength={15} />
              </Field>
            </>
          )}
        </div>

        {duplicates.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Possible duplicate — matching phone, email or GSTIN already in the CRM
            </p>
            <ul className="mt-1 space-y-0.5">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/leads/${d.id}`} className="inline-flex items-center gap-1 underline">
                    {d.code} — {d.client?.name} (owned by {d.ownerName})
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Source & ownership">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Lead source" required>
            <Select
              value={values.source}
              onChange={(e) => set("source", e.target.value as Source)}
              options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
            />
          </Field>
          <Field label="Source detail" hint="Campaign name, referrer…">
            <Input value={values.sourceDetail} onChange={(e) => set("sourceDetail", e.target.value)} />
          </Field>
          {values.source === "CHANNEL_PARTNER" && (
            <Field label="Referred by partner" hint="Drives their commission on this station.">
              <Select
                value={values.partnerId ?? ""}
                onChange={(e) => {
                  const p = partners.find((x) => x.id === e.target.value);
                  setValues((v) => ({ ...v, partnerId: p?.id ?? null, partnerName: p?.name ?? null }));
                }}
                placeholder="Select a partner"
                options={partners.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
              />
            </Field>
          )}
          <Field label="Assigned agent" required error={errors.ownerId}>
            <Select
              value={values.ownerId}
              disabled={!canReassign(viewer)}
              onChange={(e) => {
                const u = users.find((x) => x.uid === e.target.value);
                setValues((v) => ({ ...v, ownerId: e.target.value, ownerName: u?.name ?? v.ownerName }));
              }}
              options={ownerOptions.length ? ownerOptions : [{ value: values.ownerId, label: values.ownerName }]}
            />
          </Field>
          <Field label="Next follow-up">
            <Input
              type="date"
              value={toInputDate(values.nextFollowUpAt)}
              onChange={(e) => set("nextFollowUpAt", fromInputDate(e.target.value))}
            />
          </Field>
          <Field label="Expected close">
            <Input
              type="date"
              value={toInputDate(values.expectedCloseAt)}
              onChange={(e) => set("expectedCloseAt", fromInputDate(e.target.value))}
            />
          </Field>
          <Field label="Tags" className="sm:col-span-2" hint="Press Enter to add.">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-2 py-1.5">
              {values.tags.map((t) => (
                <span key={t} className="chip bg-ink-100 text-ink-700 ring-ink-200">
                  {t}
                  <button type="button" onClick={() => set("tags", values.tags.filter((x) => x !== t))} className="ml-0.5 text-ink-400 hover:text-rose-600">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder="hot, nagpur, bank-funded…"
                className="min-w-[100px] flex-1 border-0 p-0.5 text-sm focus:outline-none"
              />
            </div>
          </Field>
        </div>
      </Card>

      {showSiteDetails && (
        <Card
          title="Site details"
          subtitle="Everything needed to judge whether a charger can go here."
        >
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2">
            <p className="text-xs text-ink-600">Already have this location in the CRM? Map it instead of retyping everything.</p>
            <Button type="button" onClick={() => { setSiteSearch(""); setSiteMapOpen(true); }}>
              <MapPin className="h-4 w-4" /> Map existing location
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Location name" required error={errors["site.locationName"]}>
              <Input value={values.site.locationName ?? ""} onChange={(e) => setSite({ locationName: e.target.value })} placeholder="Kkal Layadi" />
            </Field>
            <Field label="Google Maps link" className="sm:col-span-2" hint="Paste the share link — coordinates are extracted automatically.">
              <Input
                value={values.site.mapsLink ?? ""}
                onChange={(e) => setSite({ mapsLink: e.target.value })}
                placeholder="https://maps.app.goo.gl/…"
              />
            </Field>
            <Field
              label="Site address"
              className="sm:col-span-2 lg:col-span-3"
              hint="Full postal address of where the charger installs — separate from the client's own address above. Feeds the Letter of Intent automatically."
            >
              <Textarea value={values.site.address ?? ""} onChange={(e) => setSite({ address: e.target.value })} rows={2} />
            </Field>

            <Field label="Location provider">
              <Select
                placeholder="Select"
                value={values.site.locationProvider ?? ""}
                onChange={(e) => setSite({ locationProvider: (e.target.value || null) as LocationProvider | null })}
                options={LOCATION_PROVIDERS.map((p) => ({ value: p, label: locationProviderLabel(p, settings.company.shortName) }))}
              />
            </Field>
            <Field label="Site compensation">
              <Select
                placeholder="Select"
                value={values.site.compensationType ?? ""}
                onChange={(e) => setSite({ compensationType: (e.target.value || null) as SiteCompensationType | null })}
                options={SITE_COMPENSATION_TYPES.map((t) => ({ value: t, label: SITE_COMPENSATION_TYPE_LABEL[t] }))}
              />
            </Field>
            {values.site.compensationType && (
              <Field label={values.site.compensationType === "RENTAL" ? "Rental amount (₹/month)" : "Revenue share (%)"}>
                <Input
                  type="number"
                  min={0}
                  max={values.site.compensationType === "REVENUE_SHARE" ? 100 : undefined}
                  value={values.site.compensationAmount ?? ""}
                  onChange={(e) => setSite({ compensationAmount: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
            )}
            <Field label="Tenure (years)">
              <Input
                type="number"
                min={0}
                value={values.site.tenureYears ?? ""}
                onChange={(e) => setSite({ tenureYears: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            {values.type === "FRANCHISE" && (
              <>
                <Field label="Payout period (months)" hint="Overrides the computed default on the EOI and Agreement, once set.">
                  <Input
                    type="number"
                    min={0}
                    value={values.site.payoutMonths ?? ""}
                    onChange={(e) => setSite({ payoutMonths: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Minimum assured monthly amount (₹)" hint="Overrides the pricing engine's computed figure on the EOI and Agreement, once set.">
                  <Input
                    type="number"
                    min={0}
                    value={values.site.minMonthlyPayout ?? ""}
                    onChange={(e) => setSite({ minMonthlyPayout: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
            {(isInstitutional || values.type === "FRANCHISE") && (
              <>
                <Field label="Customer selling rate (₹/kWh)" hint="Retail rate charged to the EV driver at this site." required>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.site.sellingRatePerKwh ?? ""}
                    onChange={(e) => setSite({ sellingRatePerKwh: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="DISCOM rate (₹/kWh)" hint="What this site pays its DISCOM — varies state to state and DISCOM to DISCOM.">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.site.electricityRatePerKwh ?? ""}
                    onChange={(e) => setSite({ electricityRatePerKwh: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Site owner revenue share (₹/kWh)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.site.siteOwnerSharePerKwh ?? ""}
                    onChange={(e) => setSite({ siteOwnerSharePerKwh: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label={`${settings.company.shortName || "Company"} earning (₹/kWh)`}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.site.livantoEarningPerKwh ?? ""}
                    onChange={(e) => setSite({ livantoEarningPerKwh: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field
                  label="Franchise earning (₹/kWh)"
                  hint={`Selling rate minus site owner share, ${settings.company.shortName || "the company"}'s earning and the DISCOM rate.`}
                >
                  <p className="input flex items-center bg-ink-50 font-semibold tabular-nums text-ink-900">
                    ₹{(
                      (values.site.sellingRatePerKwh ?? 0)
                      - (values.site.siteOwnerSharePerKwh ?? 0)
                      - (values.site.livantoEarningPerKwh ?? 0)
                      - (values.site.electricityRatePerKwh ?? 0)
                    ).toFixed(2)}
                  </p>
                </Field>
                <Field label="B2B rate (₹/kWh)" hint="Priced separately from the retail customer rate above — bulk/fleet customers." className="sm:col-span-2 lg:col-span-3">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="max-w-xs"
                    value={values.site.b2bRatePerKwh ?? ""}
                    onChange={(e) => setSite({ b2bRatePerKwh: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
              </>
            )}

            <Field label="Property owner">
              <Select
                placeholder="Select"
                value={values.site.ownership ?? ""}
                onChange={(e) => setSite({ ownership: (e.target.value || null) as Ownership | null })}
                options={OWNERSHIP_TYPES.map((o) => ({ value: o, label: OWNERSHIP_LABEL[o] }))}
              />
            </Field>

            <Field label="Land type" hint="Private, government and RWA land follow different approval paths.">
              <Select
                placeholder="Select"
                value={values.site.landType ?? ""}
                onChange={(e) => setSite({ landType: (e.target.value || null) as LandType | null })}
                options={LAND_TYPES.map((l) => ({ value: l, label: LAND_TYPE_LABEL[l] }))}
              />
            </Field>

            <Field label="Owner type" hint="Decides which KYC documents apply.">
              <Select
                placeholder="Select"
                value={values.site.ownerType ?? ""}
                onChange={(e) => setSite({ ownerType: (e.target.value || null) as OwnerType | null })}
                options={OWNER_TYPES.map((o) => ({ value: o, label: OWNER_TYPE_LABEL[o] }))}
              />
            </Field>
            <Field label="Power load available">
              <Select
                placeholder="Select"
                value={values.site.powerLoad ?? ""}
                onChange={(e) => setSite({ powerLoad: (e.target.value || null) as PowerLoad | null })}
                options={POWER_LOADS.map((p) => ({ value: p, label: POWER_LOAD_LABEL[p] }))}
              />
            </Field>
            <Field label="Sanctioned load (kVA)">
              <Input
                type="number"
                min={0}
                value={values.site.sanctionedLoadKva ?? ""}
                onChange={(e) => setSite({ sanctionedLoadKva: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Space available (sq.ft)" hint="300–350 for car chargers, 1,000+ for bus/truck.">
              <Input
                type="number"
                min={0}
                value={values.site.spaceAvailableSqft ?? ""}
                onChange={(e) => setSite({ spaceAvailableSqft: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Nearby landmark">
              <Input value={values.site.nearbyLandmark ?? ""} onChange={(e) => setSite({ nearbyLandmark: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Open to a commercial revenue-share model"
                checked={Boolean(values.site.commercialModelInterested)}
                onChange={(v) => setSite({ commercialModelInterested: v })}
              />
            </div>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Multi-charger hub (mixed DC + AC capacities on one site)"
                checked={Boolean(values.site.isHub)}
                onChange={(v) => setSite({ isHub: v })}
              />
            </div>

            <Field label="Location type" className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_TYPES.map((t) => {
                  const on = (values.site.locationTypes ?? []).includes(t);
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

            <Field label="Remarks" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                value={values.site.remarks ?? ""}
                onChange={(e) => setSite({ remarks: e.target.value })}
                rows={3}
                placeholder="Customer wants to install an EV charger outside his hotel; interested in 90 kW."
              />
            </Field>
          </div>
        </Card>
      )}

      {!TYPES_WITHOUT_FINANCING.includes(values.type) && (
      <Card
        title="Funding"
        subtitle="Whether the investor is paying from their own funds or taking a loan."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Funding mode" required>
            <Select
              value={values.financing.mode}
              onChange={(e) => {
                const mode = e.target.value as FundingMode;
                set("financing", {
                  ...values.financing,
                  mode,
                  stage:
                    mode === "SELF"
                      ? "NOT_APPLICABLE"
                      : values.financing.stage === "NOT_APPLICABLE"
                        ? "ENQUIRY"
                        : values.financing.stage,
                });
              }}
              options={FUNDING_MODES.map((m) => ({ value: m, label: FUNDING_MODE_LABEL[m] }))}
            />
          </Field>

          {values.financing.mode !== "SELF" && (
            <>
              <Field label="Bank / lender" hint="Full loan tracking lives on the lead's Financing tab.">
                <Input
                  list="lead-bank-list"
                  value={values.financing.bank ?? ""}
                  onChange={(e) => set("financing", { ...values.financing, bank: e.target.value })}
                  placeholder="State Bank of India"
                />
                <datalist id="lead-bank-list">
                  {BANKS.map((b) => <option key={b} value={b} />)}
                </datalist>
              </Field>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">Amount to be financed</label>
                  <div className="flex overflow-hidden rounded-md border border-ink-200 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setFundingInputMode("AMOUNT")}
                      className={cn("px-2 py-0.5", fundingInputMode === "AMOUNT" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50")}
                    >
                      ₹ Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundingInputMode("PERCENT")}
                      disabled={totalInvestment <= 0}
                      title={totalInvestment <= 0 ? "Add chargers below first to price this as a % of the total" : undefined}
                      className={cn(
                        "border-l border-ink-200 px-2 py-0.5",
                        fundingInputMode === "PERCENT" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      % of total
                    </button>
                  </div>
                </div>
                {fundingInputMode === "AMOUNT" ? (
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={values.financing.requestedAmount ?? ""}
                    onChange={(e) =>
                      set("financing", {
                        ...values.financing,
                        requestedAmount: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={values.financing.requestedAmount != null
                        ? Math.round((values.financing.requestedAmount / totalInvestment) * 10000) / 100
                        : ""}
                      onChange={(e) => {
                        const pct = e.target.value === "" ? null : Number(e.target.value);
                        set("financing", {
                          ...values.financing,
                          requestedAmount: pct == null ? null : Math.round((pct / 100) * totalInvestment),
                        });
                      }}
                    />
                    <span className="text-sm text-ink-500">%</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  {fundingInputMode === "AMOUNT"
                    ? (totalInvestment > 0 && values.financing.requestedAmount
                      ? `= ${Math.round((values.financing.requestedAmount / totalInvestment) * 10000) / 100}% of the ${formatINR(totalInvestment)} total`
                      : "Of the total investment, once chargers are configured below.")
                    : `= ${formatINR(values.financing.requestedAmount ?? 0)} of the ${formatINR(totalInvestment)} total`}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-ink-200 px-4 py-3">
          <Checkbox
            checked={Boolean(values.financing.subsidyEnabled)}
            onChange={(v) =>
              set("financing", { ...values.financing, subsidyEnabled: v })
            }
            label="Government / scheme subsidy applies"
          />
          {values.financing.subsidyEnabled && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Subsidy amount (₹)">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={values.financing.subsidyAmount ?? ""}
                  onChange={(e) =>
                    set("financing", {
                      ...values.financing,
                      subsidyAmount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Subsidy (%)" hint="Recorded alongside the amount — either can be filled in independently.">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={values.financing.subsidyPct ?? ""}
                  onChange={(e) =>
                    set("financing", {
                      ...values.financing,
                      subsidyPct: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
          )}
        </div>
      </Card>
      )}

      <Card
        title={showChargers ? "Charger configuration & quotation" : "Pricing & line items"}
        subtitle={
          showChargers
            ? "Drag chargers in — cost, GST and the payment schedule update automatically. Prices and GST slabs are editable per line."
            : "Add the priced line items for this deal — cost, GST and the payment schedule update automatically."
        }
      >
        {showChargers && (
          <Field label="Default charger OEM" hint="Individual lines can override this." className="mb-4 max-w-sm">
            <Input
              list="lead-oem-list"
              value={values.oem ?? ""}
              onChange={(e) => set("oem", e.target.value || null)}
              placeholder="Manufacturer"
            />
            <datalist id="lead-oem-list">
              {CHARGER_OEMS.map((o) => <option key={o} value={o} />)}
            </datalist>
          </Field>
        )}
        <ChargerConfigurator
          value={values.config}
          onChange={(c) => set("config", c)}
          extras={values.extras}
          onExtrasChange={(x) => set("extras", x)}
          discount={values.discount}
          onDiscountChange={(d) => set("discount", d)}
          allowDiscount={canApplyDiscount(viewer)}
          allowPriceOverride={canOverridePrice(viewer)}
          defaultOem={values.oem}
          showChargers={showChargers}
        />
      </Card>

      <div className="flex flex-wrap justify-end gap-2 pb-6">
        {onCancel && <Button type="button" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
      </div>

      <Modal
        open={siteMapOpen}
        onClose={() => setSiteMapOpen(false)}
        title="Map an existing location"
        description="Pick a location a Site Partner already offered — its address, compensation and other site details fill in below."
        wide
        footer={<Button type="button" onClick={() => setSiteMapOpen(false)}>Close</Button>}
      >
        <Input
          value={siteSearch}
          onChange={(e) => setSiteSearch(e.target.value)}
          placeholder="Search by partner, company, location name, address or city"
          className="mb-3"
        />
        {siteSearching ? (
          <p className="py-6 text-center text-sm text-ink-500">Searching…</p>
        ) : siteCandidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">No available locations found.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {Object.entries(
              siteCandidates.reduce<Record<string, LocationSearchResult[]>>((acc, r) => {
                (acc[r.partner.id] ??= []).push(r);
                return acc;
              }, {}),
            ).map(([partnerId, rows]) => (
              <div key={partnerId} className="py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {rows[0]!.partner.contactName}{rows[0]!.partner.company ? ` — ${rows[0]!.partner.company}` : ""}
                  <span className="ml-1 font-normal normal-case text-ink-400">({rows[0]!.partner.code})</span>
                </p>
                <ul className="mt-1 divide-y divide-ink-50">
                  {rows.map(({ partner, location }) => (
                    <li key={location.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{location.locationName || "Unnamed location"}</p>
                        <p className="truncate text-xs text-ink-500">
                          {partner.city ? `${partner.city} · ` : ""}{location.address || "No address on file"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          const { id, status, linkedLeadId, linkedLeadCode, createdAt, ...siteFields } = location;
                          setSite(siteFields);
                          setPendingLocationRef({ partnerId: partner.id, locationId: location.id });
                          setSiteMapOpen(false);
                        }}
                      >
                        Use this
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </form>
  );
}
