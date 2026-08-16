/**
 * Charge point connection registry + Firestore sync.
 *
 * `connections` (in-memory, per server instance) is what Phase 2's remote
 * commands will use to find a charge point's live WebSocket and send it a
 * Call — kept here now, unused for anything but bookkeeping, so that phase
 * doesn't need a registry rewrite.
 *
 * Firestore is the source of truth for anything the CRM's frontend reads;
 * this module is the only thing that writes to `chargePoints` and
 * `chargeSessions`.
 */

import type { WebSocket } from "ws";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import {
  energyWhFrom, type ConnectorStatus, type TransactionEventRequest,
} from "./ocpp/types.js";
import { accrueSiteRevenueShare } from "./revenue-share.js";
import { subscriptionDiscountFor } from "./subscriptions.js";
import { computeCost, resolveTariff } from "./tariff.js";
import { debitWalletForSession } from "./wallet.js";
import { dispatchWebhookSafe } from "./webhooks.js";

export const CHARGE_POINTS = "chargePoints";
export const CHARGE_SESSIONS = "chargeSessions";
export const CHARGER_REGISTRY = "chargerRegistry";
export const DOWNTIME_EVENTS = "downtimeEvents";

/**
 * The CRM's dashboard writes registrations here (see
 * crm/src/lib/db/charger-registry.ts) — a charge point ID is only allowed to
 * connect if it has an active registration. Keeps anyone who merely guesses
 * a charge point ID from posing as a real charger and writing fake telemetry.
 */
export async function isRegisteredAndActive(chargePointId: string): Promise<boolean> {
  const snap = await db()
    .collection(CHARGER_REGISTRY)
    .where("chargerId", "==", chargePointId)
    .where("active", "==", true)
    .limit(1)
    .get();
  return !snap.empty;
}

interface Connection {
  ws: WebSocket;
  connectedAt: number;
}

export const connections = new Map<string, Connection>();

export function registerConnection(chargePointId: string, ws: WebSocket): void {
  connections.set(chargePointId, { ws, connectedAt: Date.now() });
}

export function unregisterConnection(chargePointId: string): void {
  connections.delete(chargePointId);
}

export function isConnected(chargePointId: string): boolean {
  return connections.has(chargePointId);
}

/** Records the charger's own progress reports (Downloading/Downloaded/Installing/Installed/etc.) after an UpdateFirmware command was sent. */
export async function recordFirmwareStatus(chargePointId: string, status: string): Promise<void> {
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    { firmwareStatus: status, firmwareStatusAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/**
 * Logs a `downtimeEvents` entry for MTTR/historical-uptime reporting whenever
 * a charger reconnects after having been marked OFFLINE — the gap between
 * `disconnectedAt` and now is the outage duration.
 */
async function logDowntimeIfRecovering(chargePointId: string): Promise<void> {
  const chargePointRef = db().collection(CHARGE_POINTS).doc(chargePointId);
  const snap = await chargePointRef.get();
  const prev = snap.data();
  if (!prev || prev.status !== "OFFLINE" || !prev.disconnectedAt) return;

  const disconnectedAt = prev.disconnectedAt as Timestamp;
  const durationMinutes = Math.max(0, (Date.now() - disconnectedAt.toMillis()) / 60000);
  await db().collection(DOWNTIME_EVENTS).add({
    chargePointId,
    disconnectedAt,
    recoveredAt: FieldValue.serverTimestamp(),
    durationMinutes,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function markOnline(
  chargePointId: string,
  boot: { vendorName?: string; model?: string; serialNumber?: string; firmwareVersion?: string; reason?: string },
): Promise<void> {
  await logDowntimeIfRecovering(chargePointId).catch(() => undefined);
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    {
      chargePointId,
      status: "ONLINE",
      vendorName: boot.vendorName ?? null,
      model: boot.model ?? null,
      serialNumber: boot.serialNumber ?? null,
      firmwareVersion: boot.firmwareVersion ?? null,
      lastBootReason: boot.reason ?? null,
      connectedAt: FieldValue.serverTimestamp(),
      disconnectedAt: null,
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function markOffline(chargePointId: string): Promise<void> {
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    { status: "OFFLINE", disconnectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function touchHeartbeat(chargePointId: string): Promise<void> {
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    { lastSeenAt: FieldValue.serverTimestamp(), lastHeartbeatAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function updateConnectorStatus(
  chargePointId: string,
  evseId: number,
  connectorId: number,
  status: ConnectorStatus,
  timestamp: string,
): Promise<void> {
  const key = `evse${evseId}_conn${connectorId}`;
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    {
      lastSeenAt: FieldValue.serverTimestamp(),
      connectors: {
        [key]: { evseId, connectorId, status, reportedAt: timestamp },
      },
    },
    { merge: true },
  );
}

function sessionDocId(chargePointId: string, transactionId: string): string {
  return `${chargePointId}__${transactionId}`;
}

/**
 * Started/Updated/Ended all land here — OCPP 2.0.1 folds meter values into
 * the same TransactionEvent rather than a separate lifecycle message for
 * each, so a single upsert per event keeps the session doc current.
 */
export async function recordTransactionEvent(
  chargePointId: string,
  req: TransactionEventRequest,
): Promise<void> {
  const id = sessionDocId(chargePointId, req.transactionInfo.transactionId);
  const ref = db().collection(CHARGE_SESSIONS).doc(id);
  const energyWh = energyWhFrom(req.meterValue);

  // Idle-time tracking for idle/parking fees: each event is a fresh
  // observation of chargingState. The time since the *previous* observation
  // counts as idle if the *previous* state wasn't "Charging" — read before
  // the merge below overwrites chargingState/stateChangedAt.
  const prevSnap = await ref.get();
  const prev = prevSnap.data();
  const prevState = prev?.chargingState as string | null | undefined;
  const prevChangedAt = (prev?.stateChangedAt ?? prev?.startedAt) as Timestamp | undefined;
  let idleMinutes = (prev?.idleMinutes as number | undefined) ?? 0;
  if (req.eventType !== "Started" && prevChangedAt) {
    const elapsedMin = (new Date(req.timestamp).getTime() - prevChangedAt.toDate().getTime()) / 60000;
    if (elapsedMin > 0 && prevState && prevState !== "Charging") idleMinutes += elapsedMin;
  }

  const patch: Record<string, unknown> = {
    chargePointId,
    transactionId: req.transactionInfo.transactionId,
    evseId: req.evse?.id ?? null,
    connectorId: req.evse?.connectorId ?? null,
    chargingState: req.transactionInfo.chargingState ?? null,
    stateChangedAt: Timestamp.fromDate(new Date(req.timestamp)),
    idleMinutes: req.eventType === "Started" ? 0 : Math.round(idleMinutes * 100) / 100,
    idToken: req.idToken?.idToken ?? null,
    lastEventType: req.eventType,
    lastUpdateAt: FieldValue.serverTimestamp(),
  };

  if (req.eventType === "Started") {
    patch.status = "ACTIVE";
    patch.startedAt = Timestamp.fromDate(new Date(req.timestamp));
    if (energyWh != null) patch.energyStartWh = energyWh;
  }
  if (energyWh != null) {
    patch.latestEnergyWh = energyWh;
  }
  if (req.eventType === "Ended") {
    patch.status = "ENDED";
    patch.endedAt = Timestamp.fromDate(new Date(req.timestamp));
    patch.stoppedReason = req.transactionInfo.stoppedReason ?? null;
  }

  await ref.set(patch, { merge: true });

  // Energy delivered needs both ends on record — recompute after the merge
  // rather than trusting a stale read of the pre-merge doc.
  const snap = await ref.get();
  const data = snap.data();
  const start = data?.energyStartWh as number | undefined;
  const latest = data?.latestEnergyWh as number | undefined;
  let energyDeliveredWh: number | undefined;
  if (start != null && latest != null && latest >= start) {
    energyDeliveredWh = latest - start;
    await ref.set({ energyDeliveredWh }, { merge: true });
  }

  if (req.eventType === "Ended") {
    await billSession(ref, chargePointId, data, energyDeliveredWh);
  }
}

/**
 * Bills a just-ended session against whatever tariff currently applies.
 * A session with no matching active tariff is left unbilled (no cost
 * fields written) rather than guessing a rate — the CRM shows this
 * explicitly as "No tariff matched" instead of a silent ₹0.
 */
async function billSession(
  ref: FirebaseFirestore.DocumentReference,
  chargePointId: string,
  sessionData: FirebaseFirestore.DocumentData | undefined,
  energyDeliveredWh: number | undefined,
): Promise<void> {
  const startedAt = (sessionData?.startedAt as Timestamp | undefined)?.toDate();
  const endedAt = new Date();
  const durationMinutes = startedAt ? Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 60000) : 0;
  const idleMinutes = (sessionData?.idleMinutes as number | undefined) ?? 0;
  const connectorId = sessionData?.connectorId as number | null | undefined;

  const tariff = await resolveTariff(chargePointId, endedAt, connectorId);
  if (!tariff) return;

  const cost = computeCost(tariff, energyDeliveredWh ?? null, durationMinutes, idleMinutes);
  const idToken = sessionData?.idToken as string | null | undefined;
  const discountPct = await subscriptionDiscountFor(idToken);
  const totalCostInr = discountPct
    ? Math.round(cost.totalCostInr * (1 - discountPct / 100) * 100) / 100
    : cost.totalCostInr;

  await ref.set(
    {
      tariffId: cost.tariffId,
      tariffName: cost.tariffName,
      costBeforeGstInr: cost.costBeforeGstInr,
      gstPct: cost.gstPct,
      gstInr: cost.gstInr,
      parkingFeeInr: cost.parkingFeeInr,
      idleFeeInr: cost.idleFeeInr,
      totalCostInr,
      ...(discountPct && { subscriptionDiscountPct: discountPct }),
    },
    { merge: true },
  );

  const debited = await debitWalletForSession(idToken, totalCostInr, ref.id);
  if (debited) {
    await ref.set(
      { walletDebited: true, walletOwnerType: debited.ownerType, walletOwnerId: debited.ownerId, walletOwnerName: debited.ownerName },
      { merge: true },
    );
  }

  await accrueSiteRevenueShare(chargePointId, ref.id, totalCostInr);

  dispatchWebhookSafe("session.ended", {
    sessionId: ref.id,
    chargePointId,
    energyDeliveredWh: energyDeliveredWh ?? null,
    totalCostInr,
  });
}

export async function recordMeterValues(
  chargePointId: string,
  evseId: number,
  energyWh: number | null,
): Promise<void> {
  if (energyWh == null) return;
  // Attach to whichever active session on this charge point/evse is most
  // recently updated — Phase 1 doesn't track a separate meter-reading log.
  const snap = await db()
    .collection(CHARGE_SESSIONS)
    .where("chargePointId", "==", chargePointId)
    .where("evseId", "==", evseId)
    .where("status", "==", "ACTIVE")
    .orderBy("lastUpdateAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return;
  const ref = snap.docs[0]!.ref;
  const start = snap.docs[0]!.data().energyStartWh as number | undefined;
  const patch: Record<string, unknown> = { latestEnergyWh: energyWh, lastUpdateAt: FieldValue.serverTimestamp() };
  if (start != null && energyWh >= start) patch.energyDeliveredWh = energyWh - start;
  await ref.set(patch, { merge: true });
}
