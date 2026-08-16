"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Battery, Square } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, PageHeader, Spinner, useToast,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargeSession, type ChargeSession } from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import { sendChargerCommand } from "@/lib/ocpp-commands";
import { canManageChargers, canVerifyPayment } from "@/lib/permissions";
import { applySessionDiscount } from "@/lib/sessions-client";
import type { Zone } from "@/lib/types";
import { formatDateTime, formatINR } from "@/lib/utils";

function wh(v?: number | null): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)} kWh`;
}

function durationMinutes(session: ChargeSession): string {
  const start = session.startedAt as { toMillis?: () => number } | undefined;
  const end = session.endedAt as { toMillis?: () => number } | undefined;
  const startMs = start?.toMillis?.();
  if (!startMs) return "—";
  const endMs = end?.toMillis?.() ?? Date.now();
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hr`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const canFinance = canVerifyPayment(viewer);
  const { push } = useToast();

  const [session, setSession] = useState<ChargeSession | null | undefined>(undefined);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [commandBusy, setCommandBusy] = useState(false);
  const [discountBusy, setDiscountBusy] = useState(false);

  useEffect(() => subscribeChargeSession(id, setSession), [id]);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);

  const reg = useMemo(() => registry.find((r) => r.chargerId === session?.chargePointId), [registry, session?.chargePointId]);
  const zone = useMemo(() => (reg?.zoneId ? zones.find((z) => z.id === reg.zoneId) : undefined), [reg?.zoneId, zones]);

  async function stopSession() {
    if (!session) return;
    setCommandBusy(true);
    try {
      await sendChargerCommand(session.chargePointId, "RequestStopTransaction", { transactionId: session.transactionId });
      push("Remote stop sent.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setCommandBusy(false);
    }
  }

  async function issueDiscount() {
    if (!session) return;
    const cost = session.totalCostInr ?? 0;
    const amountStr = window.prompt(`Discount how much (₹) off this ${formatINR(cost)} session? Up to the full amount.`, "");
    if (amountStr == null) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0 || amount > cost) {
      push("Enter a valid amount up to the session's current total.", "error");
      return;
    }
    const reason = window.prompt("Reason for this discount (shown in the audit trail):", "");
    if (!reason?.trim()) {
      push("A reason is required.", "error");
      return;
    }
    setDiscountBusy(true);
    try {
      await applySessionDiscount(session.id, amount, reason.trim());
      push("Discount applied.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setDiscountBusy(false);
    }
  }

  if (session === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (session === null) return <EmptyState title="Session not found" />;

  return (
    <>
      <PageHeader
        title={`Session — ${session.chargePointId}`}
        description={`Transaction ${session.transactionId}`}
        actions={(
          <>
            <Link href="/sessions"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back to Sessions</Button></Link>
            {canManage && session.status === "ACTIVE" && (
              <Button loading={commandBusy} onClick={() => void stopSession()}><Square className="h-4 w-4" /> Remote stop</Button>
            )}
            {canFinance && session.totalCostInr != null && (
              <Button loading={discountBusy} onClick={() => void issueDiscount()}>Apply discount</Button>
            )}
          </>
        )}
      />

      <Card title="Overview" className="mb-4">
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Status" value={<Badge className={session.status === "ACTIVE" ? "bg-sky-100 text-sky-800 ring-sky-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>{session.status}</Badge>} />
          <Field label="Charger" value={<Link href={reg ? `/chargers/${reg.id}` : "#"} className="text-brand-700 hover:underline">{reg?.label ?? session.chargePointId}</Link>} />
          <Field label="Site" value={zone?.name} />
          <Field label="Connector" value={session.connectorId != null ? `#${session.connectorId}` : undefined} />
          <Field label="Started" value={formatDateTime(session.startedAt)} />
          <Field label="Ended" value={session.endedAt ? formatDateTime(session.endedAt) : "In progress"} />
          <Field label="Duration" value={durationMinutes(session)} />
          <Field label="Stop reason" value={session.stoppedReason} />
          <Field label="User" value={session.walletOwnerName} />
          <Field label="Vehicle" value={session.vehicleRegNumber ? `${session.vehicleRegNumber}${session.vehicleLabel ? ` (${session.vehicleLabel})` : ""}` : undefined} />
          <Field label="RFID / ID token" value={session.idToken ? <span className="font-mono text-xs">{session.idToken}</span> : "None"} />
          <Field label="Idle minutes" value={session.idleMinutes} />
        </dl>
      </Card>

      <Card title="Energy" className="mb-4">
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Energy delivered" value={wh(session.energyDeliveredWh)} />
          <Field label="Meter start (Wh)" value={session.energyStartWh} />
          <Field label="Latest meter (Wh)" value={session.latestEnergyWh} />
          <Field label="EVSE" value={session.evseId} />
        </dl>
        <p className="mt-3 text-xs text-ink-500">
          Live instantaneous telemetry (charger current/voltage/power, EV demand, state-of-charge) isn't persisted
          per-session yet — only cumulative meter readings from OCPP MeterValues are. Adding that needs a dedicated
          time-series store, since it changes every few seconds during a session.
        </p>
      </Card>

      <Card title="Billing">
        {session.totalCostInr == null ? (
          <p className="text-sm text-ink-500">No tariff matched — this session was never billed.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Tariff" value={session.tariffName} />
            <Field label="Cost before GST" value={session.costBeforeGstInr != null ? formatINR(session.costBeforeGstInr) : undefined} />
            <Field label="GST" value={session.gstInr != null ? `${formatINR(session.gstInr)} (${session.gstPct}%)` : undefined} />
            <Field label="Parking fee" value={session.parkingFeeInr != null ? formatINR(session.parkingFeeInr) : undefined} />
            <Field label="Idle fee" value={session.idleFeeInr != null ? formatINR(session.idleFeeInr) : undefined} />
            <Field label="Subscription discount" value={session.subscriptionDiscountPct != null ? `${session.subscriptionDiscountPct}%` : undefined} />
            {session.manualDiscountInr != null && (
              <>
                <Field label="Original cost" value={session.originalCostInr != null ? formatINR(session.originalCostInr) : undefined} />
                <Field label="Manual discount" value={`-${formatINR(session.manualDiscountInr)}`} />
                <Field label="Discount reason" value={session.manualDiscountReason} />
                <Field label="Discount by" value={session.manualDiscountBy?.name} />
              </>
            )}
            <Field label="Total" value={<span className="text-base font-semibold">{formatINR(session.totalCostInr)}</span>} />
            <Field label="Payment status" value={session.walletDebited ? <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Paid — wallet</Badge> : <Badge className="bg-amber-100 text-amber-800 ring-amber-200">Not debited</Badge>} />
          </dl>
        )}
      </Card>
    </>
  );
}
