"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertOctagon, Banknote, CheckCircle2, Plus, Printer, Trash2, Zap } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, useAsyncAction,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { createElectricityBill, deleteElectricityBill, subscribeElectricityBills, type ElectricityBillDraft } from "@/lib/db/electricity-bills";
import { subscribeFailedPayments } from "@/lib/db/failed-payments";
import { markRevenueSharePaid, markRevenueSharesPaidBatch, subscribeSiteRevenueShares } from "@/lib/db/settlements";
import { subscribeZones } from "@/lib/db/zones";
import { canManageSettlements } from "@/lib/permissions";
import type { ElectricityBill, FailedPayment, SiteRevenueShare, Zone } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function SettlementsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageSettlements(viewer);
  const { run, busy } = useAsyncAction();
  const { settings } = useSettings();
  const [statementOpen, setStatementOpen] = useState(false);

  const [rows, setRows] = useState<SiteRevenueShare[] | null>(null);
  const [zoneFilter, setZoneFilter] = useState("");
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [bills, setBills] = useState<ElectricityBill[] | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[] | null>(null);

  const [billOpen, setBillOpen] = useState(false);
  const [billZoneId, setBillZoneId] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billStart, setBillStart] = useState("");
  const [billEnd, setBillEnd] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  useEffect(() => subscribeSiteRevenueShares(setRows), []);
  useEffect(() => subscribeZones(setAllZones), []);
  useEffect(() => subscribeElectricityBills(setBills), []);
  useEffect(() => (canManage ? subscribeFailedPayments(setFailedPayments) : undefined), [canManage]);

  const zones = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows ?? []) map.set(r.zoneId, r.zoneName);
    return [...map.entries()];
  }, [rows]);

  async function submitBill() {
    if (!actor || !billZoneId || !Number(billAmount) || !billStart || !billEnd) return;
    const zone = allZones.find((z) => z.id === billZoneId);
    if (!zone) return;
    const draft: ElectricityBillDraft = {
      zoneId: billZoneId,
      zoneName: zone.name,
      amountInr: Number(billAmount),
      periodStart: new Date(billStart),
      periodEnd: new Date(billEnd),
      notes: billNotes.trim() || undefined,
    };
    await run(async () => {
      await createElectricityBill(draft, actor);
      setBillZoneId(""); setBillAmount(""); setBillStart(""); setBillEnd(""); setBillNotes(""); setBillOpen(false);
    }, "Electricity bill logged.");
  }

  const filtered = useMemo(
    () => (zoneFilter ? (rows ?? []).filter((r) => r.zoneId === zoneFilter) : rows ?? []),
    [rows, zoneFilter],
  );

  const totals = useMemo(() => {
    const pending = filtered.filter((r) => r.status === "PENDING");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((a, r) => a + r.shareAmountInr, 0),
      paidAmount: filtered.filter((r) => r.status === "PAID").reduce((a, r) => a + r.shareAmountInr, 0),
    };
  }, [filtered]);

  const pendingIdsForZone = useMemo(
    () => (zoneFilter ? filtered.filter((r) => r.status === "PENDING").map((r) => r.id) : []),
    [filtered, zoneFilter],
  );

  async function runMonthlySettlement() {
    if (pendingIdsForZone.length === 0) return;
    if (!window.confirm(`Mark all ${pendingIdsForZone.length} pending entries for this site as paid?`)) return;
    await run(() => markRevenueSharesPaidBatch(pendingIdsForZone), "Monthly settlement run complete.");
  }

  return (
    <>
      <PageHeader
        title="Settlements"
        description="Per-session revenue share owed to a site host (set on Zones & Load Balancing), accrued automatically as sessions bill. Mark an entry paid once you've actually paid the site out — this doesn't move money itself."
        actions={(
          <>
            <Select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              options={zones.map(([id, name]) => ({ value: id, label: name }))}
              placeholder="All sites"
            />
            {zoneFilter && <Button size="sm" onClick={() => setBankOpen(true)}>Bank details</Button>}
            {zoneFilter && <Button size="sm" onClick={() => setStatementOpen(true)}><Printer className="h-4 w-4" /> Statement</Button>}
            {zoneFilter && canManage && pendingIdsForZone.length > 0 && (
              <Button size="sm" variant="primary" loading={busy} onClick={() => void runMonthlySettlement()}>
                Mark all paid ({pendingIdsForZone.length})
              </Button>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Pending payout" value={formatINR(totals.pendingAmount)} tone={totals.pendingAmount ? "warn" : "default"} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Pending entries" value={totals.pendingCount} />
        <StatCard label="Paid to date" value={formatINR(totals.paidAmount)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-8 w-8" />}
          title="No revenue share accrued yet"
          description="Nothing here until a session bills at a zone that has a revenue share % set."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Site</th>
                  <th className="th">Recipient</th>
                  <th className="th">Charger</th>
                  <th className="th">When</th>
                  <th className="th text-right">Session total</th>
                  <th className="th text-right">Share %</th>
                  <th className="th text-right">Owed</th>
                  <th className="th">Status</th>
                  {canManage && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{r.zoneName}</td>
                    <td className="td text-ink-600">
                      {r.recipientName ?? "Site host"}
                      {r.kind === "GUARANTEE_TOPUP" && <Badge className="ml-1.5 bg-indigo-100 text-indigo-800 ring-indigo-200">Guarantee top-up</Badge>}
                    </td>
                    <td className="td text-ink-600">{r.chargePointId ?? "—"}</td>
                    <td className="td text-ink-600">{formatDateTime(r.createdAt)}</td>
                    <td className="td text-right tabular-nums text-ink-600">{formatINR(r.grossAmountInr)}</td>
                    <td className="td text-right tabular-nums text-ink-600">{r.shareType === "PERCENT" ? `${r.shareRate}%` : formatINR(r.shareRate)}</td>
                    <td className="td text-right tabular-nums font-medium">{formatINR(r.shareAmountInr)}</td>
                    <td className="td">
                      <Badge className={r.status === "PAID" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}>
                        {r.status === "PAID" ? "Paid" : "Pending"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        {r.status === "PENDING" && (
                          <Button size="sm" loading={busy} onClick={() => void run(() => markRevenueSharePaid(r.id), "Marked paid.")}>
                            Mark paid
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Electricity bills"
        subtitle="Manually logged DISCOM bills per site — feeds Station Profit on Business Insights. No meter integration, so this is bookkeeping input, not an automatic pull."
        actions={canManage && <Button size="sm" onClick={() => setBillOpen(true)}><Plus className="h-4 w-4" /> Log bill</Button>}
        className="mt-4"
      >
        {bills === null ? (
          <div className="flex justify-center py-8 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : bills.length === 0 ? (
          <EmptyState icon={<Zap className="h-8 w-8" />} title="No bills logged yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Site</th><th className="th">Period</th><th className="th text-right">Amount</th><th className="th">Notes</th>{canManage && <th className="th text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{b.zoneName}</td>
                    <td className="td text-ink-600">{formatDate(b.periodStart)} – {formatDate(b.periodEnd)}</td>
                    <td className="td text-right tabular-nums">{formatINR(b.amountInr)}</td>
                    <td className="td text-ink-600">{b.notes || "—"}</td>
                    {canManage && (
                      <td className="td text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Delete this ${b.zoneName} bill?`)) return;
                            void run(() => deleteElectricityBill(b.id), "Bill deleted.");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage && (
        <Card
          title="Failed payments"
          subtitle="Checkout attempts that never completed — from Razorpay's payment.failed webhook. Attempted-but-lost revenue, not a wallet transaction."
          className="mt-4"
        >
          {failedPayments === null ? (
            <div className="flex justify-center py-8 text-ink-400"><Spinner className="h-6 w-6" /></div>
          ) : failedPayments.length === 0 ? (
            <EmptyState icon={<AlertOctagon className="h-8 w-8" />} title="No failed payments logged" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr><th className="th">When</th><th className="th text-right">Amount</th><th className="th">Reason</th><th className="th">Contact</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {failedPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-ink-50">
                      <td className="td text-ink-600">{formatDateTime(p.createdAt)}</td>
                      <td className="td text-right tabular-nums">{formatINR(p.amountInr)}</td>
                      <td className="td text-ink-600">{p.errorDescription || p.errorCode || "—"}</td>
                      <td className="td text-ink-600">{p.contact || p.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={billOpen}
        onClose={() => setBillOpen(false)}
        title="Log electricity bill"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBillOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!billZoneId || !Number(billAmount) || !billStart || !billEnd}
              onClick={() => void submitBill()}
            >
              Save
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Site" required>
            <Select value={billZoneId} onChange={(e) => setBillZoneId(e.target.value)} options={allZones.map((z) => ({ value: z.id, label: z.name }))} placeholder="Choose a site" />
          </Field>
          <Field label="Amount (₹)" required><Input type="number" min={0} value={billAmount} onChange={(e) => setBillAmount(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Period start" required><Input type="date" value={billStart} onChange={(e) => setBillStart(e.target.value)} /></Field>
            <Field label="Period end" required><Input type="date" value={billEnd} onChange={(e) => setBillEnd(e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Input value={billNotes} onChange={(e) => setBillNotes(e.target.value)} placeholder="e.g. DISCOM invoice #" /></Field>
        </div>
      </Modal>

      <Modal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        title={`Statement — ${allZones.find((z) => z.id === zoneFilter)?.name ?? ""}`}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setStatementOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
          </>
        )}
      >
        <article className="print:p-0">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-ink-200 pb-3">
            <div>
              <p className="text-sm font-bold text-ink-900">{settings.company.legalName}</p>
              <p className="text-xs text-ink-500">Revenue-share statement</p>
            </div>
            <div className="text-right text-xs text-ink-500">
              <p>{allZones.find((z) => z.id === zoneFilter)?.name}</p>
              <p>Generated {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Recipient</th><th className="th">Charger</th><th className="th">When</th>
                <th className="th text-right">Owed</th><th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.recipientName ?? "Site host"}</td>
                  <td className="td text-ink-600">{r.chargePointId ?? "—"}</td>
                  <td className="td text-ink-600">{formatDateTime(r.createdAt)}</td>
                  <td className="td text-right tabular-nums">{formatINR(r.shareAmountInr)}</td>
                  <td className="td">{r.status === "PAID" ? "Paid" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 flex justify-end gap-6 border-t border-ink-200 pt-3 text-sm">
            <div className="flex items-center gap-2"><dt className="text-ink-500">Pending</dt><dd className="font-medium tabular-nums">{formatINR(totals.pendingAmount)}</dd></div>
            <div className="flex items-center gap-2"><dt className="text-ink-500">Paid</dt><dd className="font-medium tabular-nums">{formatINR(totals.paidAmount)}</dd></div>
          </dl>
        </article>
      </Modal>

      <Modal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title={`Bank details — ${allZones.find((z) => z.id === zoneFilter)?.name ?? ""}`}
        footer={<Button onClick={() => setBankOpen(false)}>Close</Button>}
      >
        {(() => {
          const z = allZones.find((zz) => zz.id === zoneFilter);
          if (!z || (!z.bankAccountNumber && !z.pocName)) {
            return <p className="text-sm text-ink-500">Nothing entered yet — set it under Zones & Load Balancing → Edit → Bank details.</p>;
          }
          return (
            <dl className="grid gap-2 text-sm">
              {z.pocName && <div className="flex justify-between"><dt className="text-ink-500">POC</dt><dd>{z.pocName}{z.pocPhone ? ` · ${z.pocPhone}` : ""}</dd></div>}
              {z.bankAccountName && <div className="flex justify-between"><dt className="text-ink-500">Account holder</dt><dd>{z.bankAccountName}</dd></div>}
              {z.bankAccountNumber && <div className="flex justify-between"><dt className="text-ink-500">Account number</dt><dd className="font-mono">{z.bankAccountNumber}</dd></div>}
              {z.bankIfscCode && <div className="flex justify-between"><dt className="text-ink-500">IFSC</dt><dd className="font-mono">{z.bankIfscCode}</dd></div>}
              {z.bankName && <div className="flex justify-between"><dt className="text-ink-500">Bank</dt><dd>{z.bankName}</dd></div>}
            </dl>
          );
        })()}
      </Modal>
    </>
  );
}
