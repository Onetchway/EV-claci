"use client";

import { Field, Input, Textarea } from "@/components/ui";
import { GST_TYPES, GST_TYPE_LABEL, type GstType } from "@/lib/constants";
import type { ShipToInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** IGST vs CGST+SGST radio — same total tax, different printed breakdown. */
export function GstTypeField({
  value, onChange, className,
}: {
  value: GstType;
  onChange: (v: GstType) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        GST Type <span className="ml-0.5 text-rose-500">*</span>
      </label>
      <div className="flex items-center gap-6">
        {GST_TYPES.map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
            <input
              type="radio"
              name="gstType"
              checked={value === t}
              onChange={() => onChange(t)}
              className={cn("h-4 w-4 text-brand-600 focus:ring-brand-500", value === t && "accent-brand-600")}
            />
            {GST_TYPE_LABEL[t]}
          </label>
        ))}
      </div>
    </div>
  );
}

/** "Ship to a different address" checkbox that reveals a name/address/GSTIN block. */
export function ShipToFields({
  enabled, onEnabledChange, value, onChange, className,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  value: ShipToInfo;
  onChange: (v: ShipToInfo) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        Ship to a different address
      </label>

      {enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Ship-to name" className="sm:col-span-2">
            <Input value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          </Field>
          <Field label="Ship-to address" className="sm:col-span-2">
            <Textarea rows={2} value={value.address ?? ""} onChange={(e) => onChange({ ...value, address: e.target.value })} />
          </Field>
          <Field label="Ship-to GSTIN">
            <Input value={value.gstin ?? ""} onChange={(e) => onChange({ ...value, gstin: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  );
}

/** Read-only printed rendering of the ship-to block, next to the bill-to block. */
export function ShipToPrintBlock({ shipTo }: { shipTo: ShipToInfo }) {
  return (
    <div>
      <p className="text-xs text-ink-500">Ship to</p>
      {shipTo.name && <p className="font-medium text-ink-900">{shipTo.name}</p>}
      {shipTo.address && <p className="whitespace-pre-wrap text-ink-600">{shipTo.address}</p>}
      {shipTo.gstin && <p className="text-ink-600">GSTIN: {shipTo.gstin}</p>}
    </div>
  );
}
