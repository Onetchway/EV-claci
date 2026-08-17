"use client";

import { Card, Field, Input, Select } from "@/components/ui";
import {
  DATE_RANGE_PRESET_OPTIONS, yearOptions, type DateRangeState,
} from "@/lib/date-range";

export function DateRangeFilter({
  state, onChange,
}: {
  state: DateRangeState;
  onChange: (next: DateRangeState) => void;
}) {
  return (
    <Card className="mb-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Range">
          <Select
            value={state.preset}
            onChange={(e) => onChange({ ...state, preset: e.target.value as DateRangeState["preset"] })}
            options={DATE_RANGE_PRESET_OPTIONS}
          />
        </Field>
        {state.preset === "year" && (
          <Field label="Year">
            <Select
              value={String(state.year)}
              onChange={(e) => onChange({ ...state, year: Number(e.target.value) })}
              options={yearOptions().map((y) => ({ value: String(y), label: String(y) }))}
            />
          </Field>
        )}
        {state.preset === "custom" && (
          <>
            <Field label="From">
              <Input type="date" value={state.customFrom} onChange={(e) => onChange({ ...state, customFrom: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={state.customTo} onChange={(e) => onChange({ ...state, customTo: e.target.value })} />
            </Field>
          </>
        )}
      </div>
    </Card>
  );
}
