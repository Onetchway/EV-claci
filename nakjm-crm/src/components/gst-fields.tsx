"use client";

import { Field } from "@/components/ui";
import { GST_TYPES, GST_TYPE_LABEL, type GstType } from "@/lib/constants";

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
