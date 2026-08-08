"use client";

import { AlertTriangle, ExternalLink, MapPin, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ChargerConfigurator } from "@/components/charger-configurator";
import { useAuth } from "@/components/auth-provider";
import {
  Button, Card, Checkbox, Field, Input, Select, Textarea, useToast,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import {
  BANKS, CHARGER_OEMS, FUNDING_MODES, FUNDING_MODE_LABEL, INDIAN_STATES,
  LAND_TYPES, LAND_TYPE_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL, LOCATION_TYPES,
  LOCATION_TYPE_LABEL, OWNERSHIP_LABEL, OWNERSHIP_TYPES, OWNER_TYPES,
  OWNER_TYPE_LABEL, POWER_LOADS, POWER_LOAD_LABEL, SOURCES, SOURCE_LABEL,
  type FundingMode, type LandType, type LeadType, type LocationType,
  type Ownership, type OwnerType, type PowerLoad, type Source,
} from "@/lib/constants";
import { DEFAULT_FINANCING, findDuplicateLeads } from "@/lib/db/leads";
import { subscribePartners } from "@/lib/db/partners";
import { canApplyDiscount, canOverridePrice, canReassign } from "@/lib/permissions";
import type { ConfigItem, ExtraItem } from "@/lib/pricing";
import type { ClientInfo, FinancingInfo, Lead, SiteInfo } from "@/lib/types";
import {
  cn, isValidEmail, isValidPan, isValidPhone, normalisePhone, parseMapsLink, toDate,
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
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel?: () => void;
  /** Existing lead id, so the duplicate check can ignore itself. */
  currentLeadId?: string;
}

export function LeadForm({ initial, submitLabel, onSubmit, onCancel, currentLeadId }: Props) {
  const { profile, role } = useAuth();
  const { users } = useAgents();
  const { push } = useToast();

  const [values, setValues] = useState<LeadFormValues>(
    () => initial ?? emptyValues(profile?.uid ?? "", profile?.name ?? ""),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Lead[]>([]);
  const [tagInput, setTagInput] = useState("");

  const viewer = useMemo(
    () => ({ uid: profile?.uid ?? "", role: role ?? "AGENT" as const }),
    [profile, role],
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
      await onSubmit({
        ...values,
        client: { ...values.client, phone: normalisePhone(values.client.phone), pan: values.client.pan?.toUpperCase() ?? "" },
        site: { ...values.site, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      });
    } catch (err) {
      push((err as Error).message || "Could not save the lead.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Lead type" subtitle="A franchise investor buys chargers; a site partner offers a location.">
        <div className="grid gap-2 sm:grid-cols-2">
          {LEAD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("type", t)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                values.type === t
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                  : "border-ink-200 bg-white hover:border-ink-300",
              )}
            >
              {t === "FRANCHISE" ? (
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              )}
              <span>
                <span className="block text-sm font-semibold text-ink-900">{LEAD_TYPE_LABEL[t]}</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {t === "FRANCHISE"
                    ? "Wants to invest in a charging franchise."
                    : "Has land or a property and wants a charger installed there."}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Client details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client name" required error={errors["client.name"]}>
            <Input value={values.client.name} onChange={(e) => setClient({ name: e.target.value })} placeholder="Shoyeb Khan" />
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
          <Field label="Company / firm">
            <Input value={values.client.company ?? ""} onChange={(e) => setClient({ company: e.target.value })} />
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
          <Field label="PAN" error={errors["client.pan"]} hint="Needed before the agreement stage.">
            <Input
              value={values.client.pan ?? ""}
              onChange={(e) => setClient({ pan: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
            />
          </Field>
          <Field label="GSTIN">
            <Input value={values.client.gstin ?? ""} onChange={(e) => setClient({ gstin: e.target.value.toUpperCase() })} maxLength={15} />
          </Field>
          <Field label="Address" className="sm:col-span-2 lg:col-span-3">
            <Textarea value={values.client.address ?? ""} onChange={(e) => setClient({ address: e.target.value })} rows={2} />
          </Field>
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

      {values.type === "SITE" && (
        <Card
          title="Site details"
          subtitle="Everything needed to judge whether a charger can go here."
        >
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
              <Field label="Amount to be financed">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={values.financing.requestedAmount ?? ""}
                  onChange={(e) =>
                    set("financing", {
                      ...values.financing,
                      requestedAmount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </>
          )}

          <Field label="Default charger OEM" hint="Individual lines can override this.">
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
        </div>
      </Card>

      <Card
        title="Charger configuration & quotation"
        subtitle="Drag chargers in — cost, GST and the payment schedule update automatically. Prices and GST slabs are editable per line."
      >
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
        />
      </Card>

      <div className="flex flex-wrap justify-end gap-2 pb-6">
        {onCancel && <Button type="button" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
