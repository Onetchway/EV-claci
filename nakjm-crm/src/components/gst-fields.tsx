"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Field, Input, Textarea } from "@/components/ui";
import { GST_TYPES, GST_TYPE_LABEL, gstStateFromGstin, type GstType } from "@/lib/constants";
import type { ClientGstRegistration } from "@/lib/types";

/** IGST vs CGST+SGST radio — same total tax, different printed breakdown. */
export function GstTypeField({
  value, onChange, className,
}: {
  value: GstType;
  onChange: (v: GstType) => void;
  className?: string;
}) {
  return (
    <Field label="GST Type" required className={className}>
      <div className="flex items-center gap-4 pt-2 text-sm">
        {GST_TYPES.map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="gstType" checked={value === t} onChange={() => onChange(t)} />
            {GST_TYPE_LABEL[t]}
          </label>
        ))}
      </div>
    </Field>
  );
}

/** "Ship to a different address" checkbox that reveals an address textarea. */
export function ShipToField({
  enabled, onEnabledChange, address, onAddressChange, className,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  address: string;
  onAddressChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        Ship to a different address
      </label>
      {enabled && (
        <div className="mt-2"><Textarea value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder="Delivery address" /></div>
      )}
    </div>
  );
}

/**
 * A client can hold a separate GST registration per state it operates in.
 * The state shown for each row is read straight off the GSTIN's own first
 * two digits (the authoritative source), not a second field that could
 * drift out of sync with it.
 */
export function GstRegistrationsField({
  value, onChange, className,
}: {
  value: ClientGstRegistration[];
  onChange: (v: ClientGstRegistration[]) => void;
  className?: string;
}) {
  function setGstin(i: number, gstin: string) {
    const next = [...value];
    next[i] = { gstin, state: gstStateFromGstin(gstin) };
    onChange(next);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <Field label="GST Registrations" hint="One per state the client is registered in — the state is read off each GSTIN automatically." className={className}>
      <div className="space-y-2">
        {value.map((reg, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={reg.gstin}
              placeholder="15-character GSTIN"
              maxLength={15}
              className="flex-1 uppercase"
              onChange={(e) => setGstin(i, e.target.value.toUpperCase())}
            />
            <span className="w-40 shrink-0 text-xs text-ink-500">{gstStateFromGstin(reg.gstin) || "—"}</span>
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-ink-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { gstin: "", state: "" }])}>
          <Plus className="h-3.5 w-3.5" /> Add registration
        </Button>
      </div>
    </Field>
  );
}
