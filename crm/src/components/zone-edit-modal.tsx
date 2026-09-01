"use client";

/** Shared site/zone editor — used by /zones (load balancing dashboard) and /stations (station management). */

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Button, Field, Input, Modal, Select, useAsyncAction,
} from "@/components/ui";
import { INDIAN_STATES, SITE_TYPE_LABEL, SITE_TYPES, type SiteType } from "@/lib/constants";
import { subscribeUsers } from "@/lib/db/users";
import { createZone, updateZone, type ZoneDraft } from "@/lib/db/zones";
import type { AdditionalRevenueShare, AppUser, RevenueShareType, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Details", "Revenue share", "Bank details"] as const;
type Tab = (typeof TABS)[number];

export function ZoneEditModal({
  open, onClose, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** null = creating a new station. */
  editing: Zone | null;
  onSaved?: (id: string) => void;
}) {
  const { actor } = useAuth();
  const { run, busy } = useAsyncAction();
  const [tab, setTab] = useState<Tab>("Details");
  const [users, setUsers] = useState<AppUser[]>([]);

  const [name, setName] = useState("");
  const [maxLoadKw, setMaxLoadKw] = useState(0);
  const [siteType, setSiteType] = useState<SiteType | "">("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocPhone, setPocPhone] = useState("");
  const [ownerUid, setOwnerUid] = useState("");
  const [discomName, setDiscomName] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [revenueShareType, setRevenueShareType] = useState<RevenueShareType | "">("");
  const [revenueShareValue, setRevenueShareValue] = useState("");
  const [electricityCostPerKwh, setElectricityCostPerKwh] = useState("");
  const [revenueShareHybridPct, setRevenueShareHybridPct] = useState("");
  const [revenueShareMinGuaranteeInr, setRevenueShareMinGuaranteeInr] = useState("");
  const [additionalRevenueShares, setAdditionalRevenueShares] = useState<AdditionalRevenueShare[]>([]);
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");

  useEffect(() => subscribeUsers(setUsers), []);

  useEffect(() => {
    if (!open) return;
    setTab("Details");
    if (editing) {
      setName(editing.name);
      setMaxLoadKw(editing.maxLoadKw);
      setSiteType(editing.siteType ?? "");
      setAddress(editing.address ?? "");
      setCity(editing.city ?? "");
      setPincode(editing.pincode ?? "");
      setState(editing.state ?? "");
      setPocName(editing.pocName ?? "");
      setPocPhone(editing.pocPhone ?? "");
      setOwnerUid(editing.ownerUid ?? "");
      setDiscomName(editing.discomName ?? "");
      setSlaHours(editing.slaHours != null ? String(editing.slaHours) : "");
      setRevenueShareType(editing.revenueShareType ?? "");
      setRevenueShareValue(editing.revenueShareValue != null ? String(editing.revenueShareValue) : "");
      setElectricityCostPerKwh(editing.electricityCostPerKwh != null ? String(editing.electricityCostPerKwh) : "");
      setRevenueShareHybridPct(editing.revenueShareHybridPct != null ? String(editing.revenueShareHybridPct) : "");
      setRevenueShareMinGuaranteeInr(editing.revenueShareMinGuaranteeInr != null ? String(editing.revenueShareMinGuaranteeInr) : "");
      setAdditionalRevenueShares(editing.additionalRevenueShares ?? []);
      setBankAccountNumber(editing.bankAccountNumber ?? "");
      setBankIfscCode(editing.bankIfscCode ?? "");
      setBankAccountName(editing.bankAccountName ?? "");
      setBankName(editing.bankName ?? "");
    } else {
      setName(""); setMaxLoadKw(0); setSiteType(""); setAddress(""); setCity(""); setPincode(""); setState("");
      setPocName(""); setPocPhone(""); setOwnerUid(""); setDiscomName(""); setSlaHours("");
      setRevenueShareType(""); setRevenueShareValue(""); setElectricityCostPerKwh(""); setRevenueShareHybridPct("");
      setRevenueShareMinGuaranteeInr(""); setAdditionalRevenueShares([]);
      setBankAccountNumber(""); setBankIfscCode(""); setBankAccountName(""); setBankName("");
    }
  }, [open, editing]);

  async function submit() {
    if (!actor || !name.trim()) return;
    const draft: ZoneDraft = {
      name: name.trim(),
      maxLoadKw,
      siteType: siteType || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      pincode: pincode.trim() || undefined,
      state: state || undefined,
      pocName: pocName.trim() || undefined,
      pocPhone: pocPhone.trim() || undefined,
      ownerUid: ownerUid || null,
      discomName: discomName.trim() || undefined,
      slaHours: slaHours.trim() ? Number(slaHours) : undefined,
      revenueShareType: revenueShareType || undefined,
      revenueShareValue: revenueShareType && revenueShareValue.trim() ? Number(revenueShareValue) : undefined,
      electricityCostPerKwh: electricityCostPerKwh.trim() ? Number(electricityCostPerKwh) : undefined,
      revenueShareHybridPct: revenueShareType === "TIERED_HYBRID" && revenueShareHybridPct.trim() ? Number(revenueShareHybridPct) : undefined,
      revenueShareMinGuaranteeInr: revenueShareMinGuaranteeInr.trim() ? Number(revenueShareMinGuaranteeInr) : undefined,
      additionalRevenueShares: additionalRevenueShares.filter((r) => r.name.trim() && r.value > 0),
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      bankIfscCode: bankIfscCode.trim() || undefined,
      bankAccountName: bankAccountName.trim() || undefined,
      bankName: bankName.trim() || undefined,
    };
    await run(async () => {
      const id = editing ? editing.id : await createZone(draft, actor);
      if (editing) await updateZone(editing.id, draft, actor);
      onClose();
      onSaved?.(id);
    }, editing ? "Station updated." : "Station created.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit station" : "New station"}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>
            {editing ? "Save" : "Create"}
          </Button>
        </>
      )}
    >
      <div className="mb-4 flex gap-1 border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === t ? "border-brand-500 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Details" && (
        <div className="grid gap-4">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DLF Green, Basement parking" />
          </Field>
          <Field label="Sanctioned load cap (kW)">
            <Input type="number" min={0} value={maxLoadKw} onChange={(e) => setMaxLoadKw(Number(e.target.value) || 0)} />
          </Field>
          <Field label="Site type">
            <Select
              value={siteType}
              onChange={(e) => setSiteType(e.target.value as SiteType | "")}
              placeholder="Select site type"
              options={SITE_TYPES.map((t) => ({ value: t, label: SITE_TYPE_LABEL[t] }))}
            />
          </Field>
          <Field label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            <Field label="Pincode"><Input value={pincode} onChange={(e) => setPincode(e.target.value)} /></Field>
            <Field label="State">
              <Select value={state} onChange={(e) => setState(e.target.value)} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="—" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="POC name" hint="Who to contact at this site."><Input value={pocName} onChange={(e) => setPocName(e.target.value)} /></Field>
            <Field label="POC phone"><Input value={pocPhone} onChange={(e) => setPocPhone(e.target.value)} /></Field>
          </div>
          <Field label="Site Owner account" hint="A staff account with the Site Owner role — they'll see only this site on Station Management and Settlements.">
            <Select
              value={ownerUid}
              onChange={(e) => setOwnerUid(e.target.value)}
              options={users.filter((u) => u.role === "SITE_OWNER").map((u) => ({ value: u.id, label: u.name }))}
              placeholder="No Site Owner linked"
            />
          </Field>
          <Field label="DISCOM name">
            <Input value={discomName} onChange={(e) => setDiscomName(e.target.value)} placeholder="e.g. BSES Rajdhani, Tata Power" />
          </Field>
          <Field label="Fault ticket SLA override (hours)">
            <Input
              type="number"
              min={0}
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              placeholder="Leave blank to use the platform default"
            />
          </Field>
        </div>
      )}

      {tab === "Revenue share" && (
        <div className="grid gap-4">
          <Field label="Share with site host?">
            <Select
              value={revenueShareType}
              onChange={(e) => setRevenueShareType(e.target.value as RevenueShareType | "")}
              options={[
                { value: "PERCENT", label: "% of each session's revenue" },
                { value: "FIXED", label: "Flat ₹ per session" },
                { value: "PER_KWH", label: "Per unit — ₹ per kWh delivered" },
                { value: "PROFIT_SHARE", label: "% of profit (revenue minus electricity cost)" },
                { value: "TIERED_HYBRID", label: "Flat floor + % of remaining profit" },
              ]}
              placeholder="No revenue share"
            />
          </Field>
          {revenueShareType && (
            <Field label={revenueShareType === "PERCENT" || revenueShareType === "PROFIT_SHARE" ? "Share (%)" : revenueShareType === "TIERED_HYBRID" ? "Guaranteed floor per session (₹)" : revenueShareType === "PER_KWH" ? "Rate (₹ per kWh)" : "Flat amount per session (₹)"}>
              <Input
                type="number"
                min={0}
                step={revenueShareType === "PER_KWH" ? "0.01" : undefined}
                max={revenueShareType === "PERCENT" || revenueShareType === "PROFIT_SHARE" ? 100 : undefined}
                value={revenueShareValue}
                onChange={(e) => setRevenueShareValue(e.target.value)}
                placeholder={revenueShareType === "PERCENT" || revenueShareType === "PROFIT_SHARE" ? "e.g. 15" : revenueShareType === "PER_KWH" ? "e.g. 2" : "e.g. 20"}
              />
            </Field>
          )}
          <Field
            label="Electricity rate (₹/kWh)"
            hint={revenueShareType === "PROFIT_SHARE" || revenueShareType === "TIERED_HYBRID"
              ? "Subtracted from each session's revenue before the share is computed, so the host is paid on margin."
              : "What this site actually pays its DISCOM per kWh — informational unless a profit-based revenue share above uses it."}
          >
            <Input type="number" min={0} step="0.01" value={electricityCostPerKwh} onChange={(e) => setElectricityCostPerKwh(e.target.value)} placeholder="e.g. 8" />
          </Field>
          {revenueShareType === "TIERED_HYBRID" && (
            <Field label="Upside share (%)" hint="On top of the guaranteed floor above, this % of whatever profit remains after electricity cost and the floor.">
              <Input type="number" min={0} max={100} value={revenueShareHybridPct} onChange={(e) => setRevenueShareHybridPct(e.target.value)} placeholder="e.g. 10" />
            </Field>
          )}
          <p className="text-xs text-ink-500">Accrues automatically per session on /settlements — e.g. an RWA hosting this charger.</p>

          <div className="border-t border-ink-100 pt-4">
            <Field label="Guaranteed minimum (₹/month)" hint="Monthly, in arrears: if the site host's accrued share (whatever type above) falls short of this across a calendar month, a top-up entry closes the gap automatically. Leave blank for no guarantee. (Different from the per-session floor+upside hybrid option above.)">
              <Input type="number" min={0} value={revenueShareMinGuaranteeInr} onChange={(e) => setRevenueShareMinGuaranteeInr(e.target.value)} placeholder="e.g. 10000" />
            </Field>
          </div>

          <div className="border-t border-ink-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="label">Other parties sharing this session</p>
              <Button
                size="sm"
                onClick={() => setAdditionalRevenueShares((prev) => [...prev, { name: "", type: "PERCENT", value: 0 }])}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-500">e.g. a CPO partner or equipment financier also splitting the same session, on top of the site host's cut above.</p>
            {additionalRevenueShares.length > 0 && (
              <div className="mt-2 grid gap-2">
                {additionalRevenueShares.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={r.name}
                      onChange={(e) => setAdditionalRevenueShares((prev) => prev.map((row, ri) => (ri === i ? { ...row, name: e.target.value } : row)))}
                      placeholder="e.g. CPO partner"
                    />
                    <Select
                      value={r.type}
                      onChange={(e) => setAdditionalRevenueShares((prev) => prev.map((row, ri) => (ri === i ? { ...row, type: e.target.value as RevenueShareType } : row)))}
                      options={[{ value: "PERCENT", label: "%" }, { value: "FIXED", label: "₹ flat" }, { value: "PER_KWH", label: "₹/kWh" }]}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      min={0}
                      value={r.value}
                      onChange={(e) => setAdditionalRevenueShares((prev) => prev.map((row, ri) => (ri === i ? { ...row, value: Number(e.target.value) || 0 } : row)))}
                    />
                    <Button size="sm" onClick={() => setAdditionalRevenueShares((prev) => prev.filter((_, ri) => ri !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Bank details" && (
        <div className="grid gap-4">
          <p className="text-xs text-ink-500">Where a settlement payout to this site's host actually goes — shown on /settlements, not validated against a real bank.</p>
          <Field label="Bank account number"><Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></Field>
          <Field label="IFSC code"><Input value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())} /></Field>
          <Field label="Account holder name"><Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} /></Field>
          <Field label="Bank name"><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
}
