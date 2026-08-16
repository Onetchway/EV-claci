"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, Checkbox, Field, Input, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { subscribeSessionsSince, type ChargeSession } from "@/lib/db/chargers";
import { subscribeCorporateAccounts, subscribeEmspUsers } from "@/lib/db/emsp-users";
import { createInvoice } from "@/lib/db/invoices";
import { subscribeOrganizations } from "@/lib/db/organizations";
import { INVOICE_BILL_TO_TYPES, type InvoiceBillToType } from "@/lib/constants";
import { canManageInvoices } from "@/lib/permissions";
import type { CorporateAccount, EmspUser, Organization } from "@/lib/types";
import { formatDateTime, formatINR } from "@/lib/utils";

function toMillis(ts: unknown): number | null {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
}

export default function NewInvoicePage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const router = useRouter();
  const { run, busy } = useAsyncAction();

  const [billToType, setBillToType] = useState<InvoiceBillToType>("MANUAL");
  const [billToId, setBillToId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualGstin, setManualGstin] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const [users, setUsers] = useState<EmspUser[]>([]);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [sessions, setSessions] = useState<ChargeSession[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => subscribeEmspUsers(setUsers), []);
  useEffect(() => subscribeCorporateAccounts(setAccounts), []);
  useEffect(() => subscribeOrganizations(setOrganizations), []);
  useEffect(() => {
    const since = new Date(periodStart);
    return subscribeSessionsSince(since, (rows) => { setSessions(rows); setSelectedIds(new Set()); });
  }, [periodStart]);

  const billedInRange = useMemo(() => {
    const endMs = new Date(periodEnd).getTime() + 24 * 60 * 60 * 1000 - 1;
    return (sessions ?? []).filter((s) => {
      if (s.totalCostInr == null || s.walletDebited) return false;
      const ended = toMillis(s.endedAt) ?? toMillis(s.lastUpdateAt);
      return ended != null && ended <= endMs;
    });
  }, [sessions, periodEnd]);

  const selected = billedInRange.filter((s) => selectedIds.has(s.id));
  const subtotalInr = selected.reduce((a, s) => a + (s.costBeforeGstInr ?? 0), 0);
  const gstInr = selected.reduce((a, s) => a + (s.gstInr ?? 0), 0);
  const totalInr = selected.reduce((a, s) => a + (s.totalCostInr ?? 0), 0);

  const billToName = billToType === "MANUAL"
    ? manualName
    : billToType === "EMSP_USER"
      ? users.find((u) => u.id === billToId)?.name ?? ""
      : accounts.find((a) => a.id === billToId)?.name ?? "";

  async function submit() {
    if (!actor || !billToName.trim() || selected.length === 0) return;
    await run(async () => {
      const { id } = await createInvoice({
        billToType, billToId: billToType === "MANUAL" ? null : billToId,
        organizationId: organizationId || null,
        billToName: billToName.trim(), billToGstin: billToType === "MANUAL" ? manualGstin.trim() : undefined,
        periodStart: new Date(periodStart), periodEnd: new Date(periodEnd),
        sessionIds: selected.map((s) => s.id), subtotalInr, gstInr, totalInr,
      }, actor);
      router.push(`/invoices/${id}`);
    }, "Invoice created.");
  }

  if (!canManageInvoices(viewer)) return <p className="text-sm text-ink-500">You don't have permission to create invoices.</p>;

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Pick a date range, then check which billed sessions belong to this bill-to party. Sessions already auto-debited from a wallet (linked RFID tag) aren't listed here — they're already paid."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Bill to">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={billToType}
                  onChange={(e) => { setBillToType(e.target.value as InvoiceBillToType); setBillToId(""); }}
                  options={INVOICE_BILL_TO_TYPES.map((t) => ({ value: t, label: t === "EMSP_USER" ? "EMSP user" : t === "CORPORATE_ACCOUNT" ? "Corporate account" : "Manual" }))}
                />
              </Field>
              {billToType === "EMSP_USER" && (
                <Field label="User"><Select value={billToId} onChange={(e) => setBillToId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Choose a user" /></Field>
              )}
              {billToType === "CORPORATE_ACCOUNT" && (
                <Field label="Account"><Select value={billToId} onChange={(e) => setBillToId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Choose an account" /></Field>
              )}
              {billToType === "MANUAL" && (
                <>
                  <Field label="Name" required><Input value={manualName} onChange={(e) => setManualName(e.target.value)} /></Field>
                  <Field label="GSTIN"><Input value={manualGstin} onChange={(e) => setManualGstin(e.target.value)} /></Field>
                </>
              )}
              <Field label="White-label tenant" hint="Optional — prints that Organisation's logo instead of the platform's own.">
                <Select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                  placeholder="None (platform branding)"
                />
              </Field>
            </div>
          </Card>

          <Card title="Period">
            <div className="grid grid-cols-2 gap-4">
              <Field label="From"><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
              <Field label="To"><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Billed sessions in range" subtitle="Check the ones that belong to this bill-to party.">
            {sessions === null ? (
              <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
            ) : billedInRange.length === 0 ? (
              <p className="text-sm text-ink-500">No billed sessions found in this period.</p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-y-auto">
                {billedInRange.map((s) => (
                  <label key={s.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                    <Checkbox
                      label={`${s.chargePointId} — ${formatDateTime(s.endedAt ?? s.lastUpdateAt)}`}
                      checked={selectedIds.has(s.id)}
                      onChange={(v) => setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(s.id); else next.delete(s.id);
                        return next;
                      })}
                    />
                    <span className="shrink-0 text-sm tabular-nums text-ink-600">{formatINR(s.totalCostInr ?? 0)}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Sessions selected</dt><dd className="tabular-nums">{selected.length}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(subtotalInr)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(gstInr)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(totalInr)}</dd></div>
            </dl>
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={!billToName.trim() || selected.length === 0}
              onClick={() => void submit()}
            >
              Create invoice
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
