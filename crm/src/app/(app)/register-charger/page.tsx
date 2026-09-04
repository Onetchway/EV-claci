"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Plug, XCircle } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  CHARGER_TYPES, CHARGER_VENDORS, CONNECTOR_TYPES, registerOwnCharger, subscribeChargerRegistry,
  type ChargerRegistration,
} from "@/lib/db/charger-registry";
import { INDIAN_STATES } from "@/lib/constants";
import { canSelfServeRegisterCharger } from "@/lib/permissions";
import type { RevenueShareType } from "@/lib/types";

/**
 * Self-serve: a Site Owner registers their own hardware and names the rate
 * they want, without touching the full Charger Management console (still
 * SUPER_ADMIN/ADMIN/OPERATIONS-only). Submits inactive and pending —
 * Firestore rules won't let this role set it any other way — so it can't
 * accept a real session until Admin/Ops reviews it on Charger Management's
 * "Pending self-serve requests" card.
 */
export default function RegisterChargerPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canSubmit = canSelfServeRegisterCharger(viewer);
  const { run, busy } = useAsyncAction();

  const [mine, setMine] = useState<ChargerRegistration[] | null>(null);
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [powerType, setPowerType] = useState<"AC" | "DC">("AC");
  const [connectorType, setConnectorType] = useState("");
  const [powerKw, setPowerKw] = useState("");
  const [vendor, setVendor] = useState<(typeof CHARGER_VENDORS)[number]>("Other");
  const [vendorOther, setVendorOther] = useState("");
  const [rateType, setRateType] = useState<RevenueShareType>("PERCENT");
  const [rateValue, setRateValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!actor) return;
    return subscribeChargerRegistry((rows) => setMine(rows.filter((r) => r.createdBy?.uid === actor.uid)));
  }, [actor]);

  if (!canSubmit) {
    return (
      <EmptyState
        title="Site Owner accounts only"
        description="Register My Charger is for self-service charger owners. If you manage the fleet directly, use Charger Management instead."
      />
    );
  }

  async function submit() {
    if (!actor || !label.trim() || !location.trim() || !vendor || !rateValue.trim()) return;
    await run(async () => {
      await registerOwnCharger({
        label: label.trim(),
        location: location.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        chargerPowerType: powerType,
        connectorType: (connectorType || undefined) as never,
        powerKw: powerKw.trim() ? Number(powerKw) : undefined,
        vendor,
        vendorOther: vendor === "Other" ? vendorOther.trim() || undefined : undefined,
        requestedRevShareType: rateType,
        requestedRevShareValue: Number(rateValue),
      }, actor);
      setLabel(""); setLocation(""); setCity(""); setState(""); setConnectorType(""); setPowerKw(""); setVendorOther(""); setRateValue("");
      setSubmitted(true);
    }, "Submitted for review.");
  }

  return (
    <>
      <PageHeader
        title="Register My Charger"
        description="Add your own charger and set the rate you want to be paid. Nothing goes live until Admin/Ops reviews and approves it — your charger stays offline (can't accept a session) until then."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="New charger">
          {submitted && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Submitted — you'll see its status below once it's reviewed.
            </p>
          )}
          <div className="grid gap-4">
            <Field label="Charger name" required><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. My Society Charger" /></Field>
            <Field label="Address" required><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="State">
                <Select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Select state"
                  options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Power type">
                <Select value={powerType} onChange={(e) => setPowerType(e.target.value as "AC" | "DC")} options={CHARGER_TYPES.map((t) => ({ value: t, label: t }))} />
              </Field>
              <Field label="Rated power (kW)"><Input type="number" min={0} value={powerKw} onChange={(e) => setPowerKw(e.target.value)} /></Field>
            </div>
            <Field label="Connector type">
              <Select value={connectorType} onChange={(e) => setConnectorType(e.target.value)} options={CONNECTOR_TYPES.map((t) => ({ value: t, label: t }))} placeholder="Select" />
            </Field>
            <Field label="Manufacturer">
              <Select value={vendor} onChange={(e) => setVendor(e.target.value as (typeof CHARGER_VENDORS)[number])} options={CHARGER_VENDORS.map((v) => ({ value: v, label: v }))} />
            </Field>
            {vendor === "Other" && (
              <Field label="Manufacturer name"><Input value={vendorOther} onChange={(e) => setVendorOther(e.target.value)} /></Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your rate" required>
                <Select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as RevenueShareType)}
                  options={[{ value: "PERCENT", label: "% of session revenue" }, { value: "FIXED", label: "Flat ₹ per kWh" }]}
                />
              </Field>
              <Field label={rateType === "PERCENT" ? "Percent" : "₹ per kWh"} required>
                <Input type="number" min={0} value={rateValue} onChange={(e) => setRateValue(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-ink-500">
              This is what you're requesting — Admin/Ops sets the final approved rate, which may differ.
            </p>
            <Button
              variant="primary"
              loading={busy}
              disabled={!label.trim() || !location.trim() || !rateValue.trim()}
              onClick={() => void submit()}
            >
              Submit for review
            </Button>
          </div>
        </Card>

        <Card title="Your chargers">
          {mine === null ? (
            <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
          ) : mine.length === 0 ? (
            <EmptyState icon={<Plug className="h-8 w-8" />} title="No chargers submitted yet" />
          ) : (
            <div className="space-y-3">
              {mine.map((r) => (
                <div key={r.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.label}</p>
                    {r.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200"><CheckCircle2 className="mr-1 inline h-3 w-3" />Approved</Badge>
                    ) : r.rejectedAt ? (
                      <Badge className="bg-rose-100 text-rose-800 ring-rose-200"><XCircle className="mr-1 inline h-3 w-3" />Not approved</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 ring-amber-200"><Clock3 className="mr-1 inline h-3 w-3" />Pending review</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{r.location}</p>
                  {r.rejectedAt && r.rejectedReason && (
                    <p className="mt-1 text-xs text-rose-600">Reason: {r.rejectedReason}</p>
                  )}
                  {r.ownerRequestedRevShareType && r.ownerRequestedRevShareValue != null && (
                    <p className="mt-1 text-xs text-ink-500">
                      Requested: {r.ownerRequestedRevShareType === "PERCENT" ? `${r.ownerRequestedRevShareValue}%` : `₹${r.ownerRequestedRevShareValue}/kWh`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
