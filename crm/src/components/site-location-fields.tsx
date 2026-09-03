"use client";

import { Trash2 } from "lucide-react";

import {
  Checkbox, Field, Input, Select, Textarea,
} from "@/components/ui";
import {
  LAND_TYPES, LAND_TYPE_LABEL, LOCATION_TYPES, LOCATION_TYPE_LABEL,
  OWNERSHIP_LABEL, OWNERSHIP_TYPES, POWER_LOADS, POWER_LOAD_LABEL,
  SITE_COMPENSATION_TYPE_LABEL, SITE_COMPENSATION_TYPES,
  type LandType, type LocationType, type Ownership, type PowerLoad, type SiteCompensationType,
} from "@/lib/constants";
import type { SiteLocation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One location's fields — reused by the "add a location" form and the location editor on a Site Partner's detail page. */
export function SiteLocationFields({
  value, onChange, onRemove, index,
}: {
  value: SiteLocation;
  onChange: (patch: Partial<SiteLocation>) => void;
  onRemove?: () => void;
  index?: number;
}) {
  const toggleLocationType = (t: LocationType) => {
    const current = value.locationTypes ?? [];
    onChange({ locationTypes: current.includes(t) ? current.filter((x) => x !== t) : [...current, t] });
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">
          {index != null ? `Location ${index + 1}` : "Location"}
          {value.status && value.status !== "AVAILABLE" && (
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              value.status === "MAPPED" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200",
            )}
            >
              {value.status === "MAPPED" ? `Mapped to ${value.linkedLeadCode ?? "a lead"}` : "Rejected"}
            </span>
          )}
        </p>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove location">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Location name" required className="sm:col-span-2">
          <Input value={value.locationName ?? ""} onChange={(e) => onChange({ locationName: e.target.value })} placeholder="Kkal Layadi" />
        </Field>
        <Field label="Google Maps link" hint="Paste the share link.">
          <Input value={value.mapsLink ?? ""} onChange={(e) => onChange({ mapsLink: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
        </Field>
        <Field label="Address" className="sm:col-span-2 lg:col-span-3">
          <Textarea rows={2} value={value.address ?? ""} onChange={(e) => onChange({ address: e.target.value })} />
        </Field>

        <Field label="Site compensation">
          <Select
            placeholder="Select"
            value={value.compensationType ?? ""}
            onChange={(e) => onChange({ compensationType: (e.target.value || null) as SiteCompensationType | null })}
            options={SITE_COMPENSATION_TYPES.map((t) => ({ value: t, label: SITE_COMPENSATION_TYPE_LABEL[t] }))}
          />
        </Field>
        {value.compensationType && (
          <Field label={value.compensationType === "RENTAL" ? "Rental amount (₹/month)" : "Revenue share (%)"}>
            <Input
              type="number"
              min={0}
              max={value.compensationType === "REVENUE_SHARE" ? 100 : undefined}
              value={value.compensationAmount ?? ""}
              onChange={(e) => onChange({ compensationAmount: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
        )}
        <Field label="Tenure (years)">
          <Input type="number" min={0} value={value.tenureYears ?? ""} onChange={(e) => onChange({ tenureYears: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>

        <Field label="Property owner">
          <Select
            placeholder="Select"
            value={value.ownership ?? ""}
            onChange={(e) => onChange({ ownership: (e.target.value || null) as Ownership | null })}
            options={OWNERSHIP_TYPES.map((o) => ({ value: o, label: OWNERSHIP_LABEL[o] }))}
          />
        </Field>
        <Field label="Land type">
          <Select
            placeholder="Select"
            value={value.landType ?? ""}
            onChange={(e) => onChange({ landType: (e.target.value || null) as LandType | null })}
            options={LAND_TYPES.map((l) => ({ value: l, label: LAND_TYPE_LABEL[l] }))}
          />
        </Field>
        <Field label="Power load available">
          <Select
            placeholder="Select"
            value={value.powerLoad ?? ""}
            onChange={(e) => onChange({ powerLoad: (e.target.value || null) as PowerLoad | null })}
            options={POWER_LOADS.map((p) => ({ value: p, label: POWER_LOAD_LABEL[p] }))}
          />
        </Field>
        <Field label="Sanctioned load (kVA)">
          <Input type="number" min={0} value={value.sanctionedLoadKva ?? ""} onChange={(e) => onChange({ sanctionedLoadKva: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Space available (sq.ft)" hint="300–350 for car chargers, 1,000+ for bus/truck.">
          <Input type="number" min={0} value={value.spaceAvailableSqft ?? ""} onChange={(e) => onChange({ spaceAvailableSqft: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Nearby landmark">
          <Input value={value.nearbyLandmark ?? ""} onChange={(e) => onChange({ nearbyLandmark: e.target.value })} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            label="Open to a commercial revenue-share model"
            checked={Boolean(value.commercialModelInterested)}
            onChange={(v) => onChange({ commercialModelInterested: v })}
          />
        </div>

        <Field label="Location type" className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap gap-1.5">
            {LOCATION_TYPES.map((t) => {
              const on = (value.locationTypes ?? []).includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleLocationType(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                    on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-600 ring-ink-300 hover:bg-ink-50",
                  )}
                >
                  {LOCATION_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Remarks" className="sm:col-span-2 lg:col-span-3">
          <Textarea rows={2} value={value.remarks ?? ""} onChange={(e) => onChange({ remarks: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
