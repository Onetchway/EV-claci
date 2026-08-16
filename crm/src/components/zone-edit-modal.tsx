"use client";

/** Shared site/zone editor — used by /zones (load balancing dashboard) and /stations (station management). */

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  Button, Field, Input, Modal, Select, useAsyncAction,
} from "@/components/ui";
import { INDIAN_STATES, SITE_TYPE_LABEL, SITE_TYPES, type SiteType } from "@/lib/constants";
import { createZone, updateZone, type ZoneDraft } from "@/lib/db/zones";
import type { RevenueShareType, Zone } from "@/lib/types";
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

  const [name, setName] = useState("");
  const [maxLoadKw, setMaxLoadKw] = useState(0);
  const [siteType, setSiteType] = useState<SiteType | "">("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocPhone, setPocPhone] = useState("");
  const [discomName, setDiscomName] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [revenueShareType, setRevenueShareType] = useState<RevenueShareType | "">("");
  const [revenueShareValue, setRevenueShareValue] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");

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
      setDiscomName(editing.discomName ?? "");
      setSlaHours(editing.slaHours != null ? String(editing.slaHours) : "");
      setRevenueShareType(editing.revenueShareType ?? "");
      setRevenueShareValue(editing.revenueShareValue != null ? String(editing.revenueShareValue) : "");
      setBankAccountNumber(editing.bankAccountNumber ?? "");
      setBankIfscCode(editing.bankIfscCode ?? "");
      setBankAccountName(editing.bankAccountName ?? "");
      setBankName(editing.bankName ?? "");
    } else {
      setName(""); setMaxLoadKw(0); setSiteType(""); setAddress(""); setCity(""); setPincode(""); setState("");
      setPocName(""); setPocPhone(""); setDiscomName(""); setSlaHours("");
      setRevenueShareType(""); setRevenueShareValue("");
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
      discomName: discomName.trim() || undefined,
      slaHours: slaHours.trim() ? Number(slaHours) : undefined,
      revenueShareType: revenueShareType || undefined,
      revenueShareValue: revenueShareType && revenueShareValue.trim() ? Number(revenueShareValue) : undefined,
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      bankIfscCode: bankIfscCode.trim() || undefined,
      bankAccountName: bankAccountName.trim() || undefined,
      bankName: bankName.trim() || undefined,
    };
    await run(async () => {
      const id = editing ? editing.id : await createZone(draft, actor);
      if (editing) await updateZone(editing.id, draft);
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
          <div className="grid grid-cols-3 gap-4">
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
              options={[{ value: "PERCENT", label: "Yes — % of each session" }, { value: "FIXED", label: "Yes — flat ₹ per session" }]}
              placeholder="No revenue share"
            />
          </Field>
          {revenueShareType && (
            <Field label={revenueShareType === "PERCENT" ? "Share (%)" : "Flat amount per session (₹)"}>
              <Input
                type="number"
                min={0}
                max={revenueShareType === "PERCENT" ? 100 : undefined}
                value={revenueShareValue}
                onChange={(e) => setRevenueShareValue(e.target.value)}
                placeholder={revenueShareType === "PERCENT" ? "e.g. 15" : "e.g. 20"}
              />
            </Field>
          )}
          <p className="text-xs text-ink-500">Accrues automatically per session on /settlements — e.g. an RWA hosting this charger.</p>
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
