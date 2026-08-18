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
import { OCPI_COUNTRY_CODE, OCPI_PARTY_ID, pushOcpiUpdateSafe } from "./ocpi-push.js";
import { fireWorkflowTrigger } from "./workflow-engine.js";

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
/**
 * A charger must be registered + active to connect at all. If its
 * registration also carries a connectionToken (a lightweight per-charger
 * secret — see the CRM's "Connect to Charger" URL), the caller's token
 * must match it too. Registrations from before this feature existed have
 * no token set, so they connect exactly as they did before — this never
 * locks out an already-deployed charger.
 */
export async function isRegisteredAndActive(chargePointId: string, token?: string | null): Promise<boolean> {
  const snap = await db()
    .collection(CHARGER_REGISTRY)
    .where("chargerId", "==", chargePointId)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const registeredToken = snap.docs[0]!.data().connectionToken as string | undefined;
  if (!registeredToken) return true;
  return registeredToken === token;
}

const OCPI_CONNECTOR_STANDARD: Record<string, string> = {
  "Type 2": "IEC_62196_T2",
  CCS2: "IEC_62196_T2_COMBO",
  CHAdeMO: "CHADEMO",
  "GB/T": "GBT_AC",
  "Bharat AC-001": "IEC_62196_T2",
  "Bharat DC-001": "GBT_DC",
};

const OCPI_CONNECTOR_STATUS: Record<string, string> = {
  Available: "AVAILABLE",
  Occupied: "CHARGING",
  Reserved: "RESERVED",
  Unavailable: "INOPERATIVE",
  Faulted: "OUTOFORDER",
};

function toIsoTs(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  return (d ?? new Date()).toISOString();
}

/** Mirrors crm/src/lib/ocpi/mappers.ts's mapLocations, but for one charger — built fresh from Firestore for a background OCPI push rather than reused from the CRM app (separate deployable, see ocpi-push.ts). */
async function buildOcpiLocationPayload(chargePointId: string): Promise<Record<string, unknown> | null> {
  const [registrySnap, pointSnap] = await Promise.all([
    db().collection(CHARGER_REGISTRY).where("chargerId", "==", chargePointId).where("active", "==", true).limit(1).get(),
    db().collection(CHARGE_POINTS).doc(chargePointId).get(),
  ]);
  if (registrySnap.empty) return null;
  const r = registrySnap.docs[0]!.data();
  if (r.lat == null || r.lng == null) return null;
  const live = pointSnap.data();

  const connectors = r.connectorType ? [{
    id: "1",
    standard: OCPI_CONNECTOR_STANDARD[r.connectorType as string] ?? "IEC_62196_T2",
    format: "CABLE",
    power_type: r.chargerPowerType === "DC" ? "DC" : "AC_3_PHASE",
    max_voltage: 400,
    max_amperage: r.powerKw ? Math.round(((r.powerKw as number) * 1000) / 400) : 32,
    max_electric_power: ((r.powerKw as number) ?? 0) * 1000,
    last_updated: toIsoTs(live?.lastSeenAt),
  }] : [];

  const connectorStatuses = live?.connectors ? Object.values(live.connectors as Record<string, { status: string }>) : [];
  const evseStatus = live?.status !== "ONLINE"
    ? "OUTOFORDER"
    : (OCPI_CONNECTOR_STATUS[connectorStatuses[0]?.status ?? "Available"] ?? "UNKNOWN");

  return {
    country_code: OCPI_COUNTRY_CODE,
    party_id: OCPI_PARTY_ID,
    id: chargePointId,
    publish: true,
    name: r.label,
    address: r.location,
    city: r.location,
    country: "IND",
    coordinates: { latitude: String(r.lat), longitude: String(r.lng) },
    evses: [{
      uid: chargePointId,
      evse_id: `${OCPI_COUNTRY_CODE}*${OCPI_PARTY_ID}*E${chargePointId}`,
      status: evseStatus,
      connectors,
      last_updated: toIsoTs(live?.lastSeenAt),
    }],
    last_updated: toIsoTs(live?.lastSeenAt ?? r.createdAt),
  };
}

export type OcppProtocolVersion = "ocpp2.0.1" | "ocpp1.6";

interface Connection {
  ws: WebSocket;
  connectedAt: number;
  protocol: OcppProtocolVersion;
}

export const connections = new Map<string, Connection>();

export function registerConnection(chargePointId: string, ws: WebSocket, protocol: OcppProtocolVersion): void {
  connections.set(chargePointId, { ws, connectedAt: Date.now(), protocol });
  // Best-effort — the in-memory connections Map (protocolFor, above) is the
  // source of truth commands.ts actually depends on; this write is purely so
  // the CRM's charger detail page can show which dialect a charger
  // negotiated without needing its own live connection to this instance.
  db().collection(CHARGE_POINTS).doc(chargePointId).set({ protocol }, { merge: true })
    .catch((err) => console.error(`[registry] failed to persist protocol for ${chargePointId}:`, err));
}

export function unregisterConnection(chargePointId: string): void {
  connections.delete(chargePointId);
}

export function isConnected(chargePointId: string): boolean {
  return connections.has(chargePointId);
}

/** Which OCPP wire dialect this charge point negotiated — commands.ts uses this to translate outbound Calls for 1.6 chargers. Defaults to 2.0.1 if the charger isn't currently connected (matches the pre-1.6 assumption). */
export function protocolFor(chargePointId: string): OcppProtocolVersion {
  return connections.get(chargePointId)?.protocol ?? "ocpp2.0.1";
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
  dispatchWebhookSafe("charger.online", { chargePointId });
  pushOcpiUpdateSafe("locations", chargePointId, () => buildOcpiLocationPayload(chargePointId));
}

/**
 * Charger-level (not per-connector) operational status — set from a
 * ChangeAvailability command's own Accepted result, since OCPP 2.0.1
 * doesn't otherwise push a whole-station availability notification back.
 */
export async function recordOperationalStatus(chargePointId: string, operationalStatus: "OPERATIVE" | "INOPERATIVE"): Promise<void> {
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    { operationalStatus, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function markOffline(chargePointId: string): Promise<void> {
  await db().collection(CHARGE_POINTS).doc(chargePointId).set(
    { status: "OFFLINE", disconnectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  dispatchWebhookSafe("charger.offline", { chargePointId });
  pushOcpiUpdateSafe("locations", chargePointId, () => buildOcpiLocationPayload(chargePointId));
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
  pushOcpiUpdateSafe("locations", chargePointId, () => buildOcpiLocationPayload(chargePointId));
}

export function sessionDocId(chargePointId: string, transactionId: string): string {
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

  pushOcpiUpdateSafe("sessions", ref.id, async () => ({
    country_code: OCPI_COUNTRY_CODE,
    party_id: OCPI_PARTY_ID,
    id: ref.id,
    start_date_time: toIsoTs(data?.startedAt),
    end_date_time: data?.endedAt ? toIsoTs(data.endedAt) : undefined,
    kwh: (energyDeliveredWh ?? 0) / 1000,
    currency: "INR",
    status: data?.status === "ACTIVE" ? "ACTIVE" : "COMPLETED",
    last_updated: new Date().toISOString(),
  }));

  if (req.eventType === "Ended") {
    await billSession(ref, chargePointId, data, energyDeliveredWh);
  }
}

/**
 * OCPP 1.6's transaction model differs enough from 2.0.1's unified
 * TransactionEvent that it gets its own write path here rather than being
 * shoehorned into recordTransactionEvent: 1.6 has a separate
 * StartTransaction/StopTransaction pair, the CSMS (not the charge point)
 * assigns the transactionId, and there's no evse concept — every 1.6
 * charge point is treated as a single EVSE (evseId 1), same assumption
 * UnlockConnector's default already makes elsewhere in this codebase.
 * MeterValues arrives separately and isn't folded into a transaction event
 * the way 2.0.1 does it, so idle-time tracking (present in
 * recordTransactionEvent) isn't replicated here — a known simplification.
 */
export async function start16Transaction(
  chargePointId: string,
  connectorId: number,
  idTag: string,
  meterStartWh: number,
  timestamp: string,
): Promise<number> {
  const transactionId = Date.now();
  const ref = db().collection(CHARGE_SESSIONS).doc(sessionDocId(chargePointId, String(transactionId)));
  await ref.set({
    chargePointId,
    transactionId: String(transactionId),
    evseId: 1,
    connectorId,
    idToken: idTag,
    status: "ACTIVE",
    startedAt: Timestamp.fromDate(new Date(timestamp)),
    energyStartWh: meterStartWh,
    latestEnergyWh: meterStartWh,
    idleMinutes: 0,
    lastEventType: "Started",
    lastUpdateAt: FieldValue.serverTimestamp(),
  });

  pushOcpiUpdateSafe("sessions", ref.id, async () => ({
    country_code: OCPI_COUNTRY_CODE,
    party_id: OCPI_PARTY_ID,
    id: ref.id,
    start_date_time: timestamp,
    kwh: 0,
    currency: "INR",
    status: "ACTIVE",
    last_updated: new Date().toISOString(),
  }));

  return transactionId;
}

export async function record16MeterValue(
  chargePointId: string,
  transactionId: number,
  energyWh: number | null,
  socPercent: number | null,
): Promise<void> {
  const ref = db().collection(CHARGE_SESSIONS).doc(sessionDocId(chargePointId, String(transactionId)));
  const snap = await ref.get();
  const data = snap.data();
  if (!data || data.status !== "ACTIVE") return;
  const start = data.energyStartWh as number | undefined;
  const patch: Record<string, unknown> = { lastUpdateAt: FieldValue.serverTimestamp() };
  let energyDeliveredWh: number | undefined;
  if (energyWh != null) {
    patch.latestEnergyWh = energyWh;
    if (start != null && energyWh >= start) {
      energyDeliveredWh = energyWh - start;
      patch.energyDeliveredWh = energyDeliveredWh;
    }
  }
  if (socPercent != null) patch.socPercent = socPercent;
  await ref.set(patch, { merge: true });

  pushOcpiUpdateSafe("sessions", ref.id, async () => ({
    country_code: OCPI_COUNTRY_CODE,
    party_id: OCPI_PARTY_ID,
    id: ref.id,
    start_date_time: toIsoTs(data.startedAt),
    kwh: (energyDeliveredWh ?? 0) / 1000,
    currency: "INR",
    status: "ACTIVE",
    last_updated: new Date().toISOString(),
  }));
}

export async function stop16Transaction(
  chargePointId: string,
  transactionId: number,
  meterStopWh: number,
  timestamp: string,
  reason: string | undefined,
): Promise<void> {
  const ref = db().collection(CHARGE_SESSIONS).doc(sessionDocId(chargePointId, String(transactionId)));
  const snap = await ref.get();
  const prev = snap.data();
  if (!prev) {
    console.warn(`[ocpp1.6] StopTransaction for unknown transaction ${transactionId} on ${chargePointId}`);
    return;
  }
  const start = prev.energyStartWh as number | undefined;
  const energyDeliveredWh = start != null && meterStopWh >= start ? meterStopWh - start : undefined;

  const patch: Record<string, unknown> = {
    status: "ENDED",
    endedAt: Timestamp.fromDate(new Date(timestamp)),
    stoppedReason: reason ?? null,
    latestEnergyWh: meterStopWh,
    lastEventType: "Ended",
    lastUpdateAt: FieldValue.serverTimestamp(),
    ...(energyDeliveredWh != null && { energyDeliveredWh }),
  };
  await ref.set(patch, { merge: true });

  const data = { ...prev, ...patch };
  await billSession(ref, chargePointId, data, energyDeliveredWh);
}

/**
 * Traces an id token → its rfidTokens doc → the EMSP user it's assigned to
 * (if any), independent of whether a debit actually happens — a durable
 * "who charged" reference on every session, not just ones that got billed
 * to a wallet. debitWalletForSession resolves the same chain again for the
 * actual debit; kept separate so a ₹0 or unbilled session still records
 * who it was, which billing (only triggered by a real debit) can't.
 */
async function lookupWalletOwnerForIdToken(
  idToken: string | null | undefined,
): Promise<{ emspUserId: string; ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT"; ownerId: string; ownerName: string } | null> {
  if (!idToken) return null;
  const tokenSnap = await db().collection("rfidTokens").where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return null;
  const tokenId = tokenSnap.docs[0]!.id;
  const userSnap = await db().collection("emspUsers").where("rfidTokenId", "==", tokenId).limit(1).get();
  if (userSnap.empty) return null;
  const userDoc = userSnap.docs[0]!;
  const user = userDoc.data();
  const corporateAccountId = user.corporateAccountId as string | null | undefined;
  const ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT" = corporateAccountId ? "CORPORATE_ACCOUNT" : "EMSP_USER";
  const ownerId = corporateAccountId ?? userDoc.id;
  let ownerName = (user.name as string | undefined) ?? "Unknown";
  if (ownerType === "CORPORATE_ACCOUNT") {
    const accSnap = await db().collection("corporateAccounts").doc(ownerId).get();
    ownerName = (accSnap.data()?.name as string | undefined) ?? ownerName;
  }
  return { emspUserId: userDoc.id, ownerType, ownerId, ownerName };
}

/** Traces an id token → its rfidTokens doc → the vehicle it's assigned to (if any), so a session can be attributed to a specific fleet vehicle. */
async function lookupVehicleForIdToken(
  idToken: string | null | undefined,
): Promise<{ id: string; regNumber: string; carLabel: string } | null> {
  if (!idToken) return null;
  const tokenSnap = await db().collection("rfidTokens").where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return null;
  const tokenId = tokenSnap.docs[0]!.id;
  const vehicleSnap = await db().collection("vehicles").where("rfidTokenId", "==", tokenId).limit(1).get();
  if (vehicleSnap.empty) return null;
  const v = vehicleSnap.docs[0]!.data();
  return { id: vehicleSnap.docs[0]!.id, regNumber: v.regNumber as string, carLabel: v.carLabel as string };
}

/**
 * Bills a just-ended session against whatever tariff currently applies.
 * A session with no matching active tariff is left unbilled (no cost
 * fields written) rather than guessing a rate — the CRM shows this
 * explicitly as "No tariff matched" instead of a silent ₹0.
 */
export async function billSession(
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
  const idToken = sessionData?.idToken as string | null | undefined;

  const tariff = await resolveTariff(chargePointId, endedAt, connectorId, idToken);
  if (!tariff) return;

  const cost = computeCost(tariff, energyDeliveredWh ?? null, durationMinutes, idleMinutes);
  const discountPct = await subscriptionDiscountFor(idToken);
  const totalCostInr = discountPct
    ? Math.round(cost.totalCostInr * (1 - discountPct / 100) * 100) / 100
    : cost.totalCostInr;
  const vehicle = await lookupVehicleForIdToken(idToken);
  const walletOwner = await lookupWalletOwnerForIdToken(idToken);

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
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      ...(discountPct && { subscriptionDiscountPct: discountPct }),
      ...(vehicle && { vehicleId: vehicle.id, vehicleRegNumber: vehicle.regNumber, vehicleLabel: vehicle.carLabel }),
      ...(walletOwner && {
        emspUserId: walletOwner.emspUserId,
        walletOwnerType: walletOwner.ownerType,
        walletOwnerId: walletOwner.ownerId,
        walletOwnerName: walletOwner.ownerName,
      }),
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

  // App-less QR charging (see qr-budget-guard.ts) pays per-session up front
  // via Razorpay, not a wallet — debitWalletForSession above finds no
  // wallet owner for a QR session's one-time idToken and is a no-op, which
  // is correct. This is the only place that ties the session back to the
  // payment that actually funded it.
  if (idToken?.startsWith("QR-")) {
    const qrSnap = await db().collection("qrChargeSessions").doc(idToken).get();
    const qr = qrSnap.data();
    if (qr) {
      await ref.set({ paymentRef: qr.razorpayPaymentId ?? null, qrSession: true }, { merge: true });
      await qrSnap.ref.set({ status: "ENDED", endedAt: FieldValue.serverTimestamp(), finalCostInr: totalCostInr }, { merge: true });
    }
  }

  await accrueSiteRevenueShare(chargePointId, ref.id, totalCostInr, energyDeliveredWh ?? 0);

  // A persisted Charge Detail Record — previously OCPI's /cdrs endpoint
  // reconstructed this on every request straight from chargeSessions; now
  // it's a durable document written once at billing time, which is what a
  // roaming CDR is supposed to be (an immutable settlement record, not a
  // live-recomputed view).
  await db().collection("cdrs").doc(ref.id).set(
    {
      sessionId: ref.id,
      chargePointId,
      transactionId: sessionData?.transactionId ?? null,
      startedAt: sessionData?.startedAt ?? null,
      endedAt: Timestamp.fromDate(endedAt),
      energyDeliveredWh: energyDeliveredWh ?? null,
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      tariffId: cost.tariffId,
      costBeforeGstInr: cost.costBeforeGstInr,
      gstPct: cost.gstPct,
      gstInr: cost.gstInr,
      totalCostInr,
      currency: "INR",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  dispatchWebhookSafe("session.ended", {
    sessionId: ref.id,
    chargePointId,
    energyDeliveredWh: energyDeliveredWh ?? null,
    totalCostInr,
  });
  void fireWorkflowTrigger("SESSION_COMPLETED", {
    chargePointId, sessionId: ref.id, energyDeliveredWh: energyDeliveredWh ?? null, totalCostInr,
  });

  pushOcpiUpdateSafe("cdrs", ref.id, async () => ({
    country_code: OCPI_COUNTRY_CODE,
    party_id: OCPI_PARTY_ID,
    id: ref.id,
    start_date_time: toIsoTs(sessionData?.startedAt),
    end_date_time: endedAt.toISOString(),
    total_energy: (energyDeliveredWh ?? 0) / 1000,
    total_cost: { excl_vat: cost.costBeforeGstInr, incl_vat: totalCostInr },
    currency: "INR",
    last_updated: new Date().toISOString(),
  }));
}

export async function recordMeterValues(
  chargePointId: string,
  evseId: number,
  energyWh: number | null,
  socPercent: number | null,
): Promise<void> {
  // Previously bailed out entirely (including skipping the lastUpdateAt
  // bump) whenever a sample didn't carry the energy register measurand —
  // so a charger sending frequent MeterValues with only SoC, or with the
  // energy register on a different cadence, looked "stuck" in the CRM even
  // though it was reporting the whole time. Only the energy-specific
  // fields are conditional now; a session write (and the liveness signal
  // that comes with it) happens whenever there's anything to record.
  if (energyWh == null && socPercent == null) return;
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
  const patch: Record<string, unknown> = { lastUpdateAt: FieldValue.serverTimestamp() };
  if (energyWh != null) {
    patch.latestEnergyWh = energyWh;
    if (start != null && energyWh >= start) patch.energyDeliveredWh = energyWh - start;
  }
  if (socPercent != null) patch.socPercent = socPercent;
  await ref.set(patch, { merge: true });
}
