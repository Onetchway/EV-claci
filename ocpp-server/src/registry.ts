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

export const CHARGE_POINTS = "chargePoints";
export const CHARGE_SESSIONS = "chargeSessions";

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

export async function markOnline(
  chargePointId: string,
  boot: { vendorName?: string; model?: string; serialNumber?: string; firmwareVersion?: string; reason?: string },
): Promise<void> {
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

  const patch: Record<string, unknown> = {
    chargePointId,
    transactionId: req.transactionInfo.transactionId,
    evseId: req.evse?.id ?? null,
    connectorId: req.evse?.connectorId ?? null,
    chargingState: req.transactionInfo.chargingState ?? null,
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
  const start = snap.data()?.energyStartWh as number | undefined;
  const latest = snap.data()?.latestEnergyWh as number | undefined;
  if (start != null && latest != null && latest >= start) {
    await ref.set({ energyDeliveredWh: latest - start }, { merge: true });
  }
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
