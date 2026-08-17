"use client";

/**
 * Read-only client for the OCPP central system's data (ocpp-server/, a
 * separate Cloud Run service). That server is the only writer to these
 * collections — Firestore rules enforce it — so this file only subscribes,
 * it never creates or updates a charge point or session.
 */

import {
  collection, doc, limit as fsLimit, onSnapshot, orderBy, query, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { ChargerReview, TS } from "../types";

export const CHARGE_POINTS = "chargePoints";
export const CHARGE_SESSIONS = "chargeSessions";
export const DOWNTIME_EVENTS = "downtimeEvents";
export const CHARGER_REVIEWS = "chargerReviews";

export type ChargePointStatus = "ONLINE" | "OFFLINE";
export type ConnectorStatus = "Available" | "Occupied" | "Reserved" | "Unavailable" | "Faulted";

export interface ConnectorState {
  evseId: number;
  connectorId: number;
  status: ConnectorStatus;
  reportedAt: string;
}

export interface ChargePoint {
  id: string;
  chargePointId: string;
  status: ChargePointStatus;
  vendorName?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  firmwareVersion?: string | null;
  lastBootReason?: string | null;
  /** Latest FirmwareStatusNotification reported after an UpdateFirmware command — e.g. Downloading/Downloaded/Installing/Installed/InstallationFailed. */
  firmwareStatus?: string | null;
  firmwareStatusAt?: TS;
  /** The OCPP dialect this charger negotiated on its current (or most recent) connection — written by ocpp-server's registerConnection. Absent for a charger that's never connected since this field was added. */
  protocol?: "ocpp2.0.1" | "ocpp1.6";
  connectors?: Record<string, ConnectorState>;
  /** Charger-level (not per-connector) availability, set from a ChangeAvailability command's Accepted result. */
  operationalStatus?: "OPERATIVE" | "INOPERATIVE";
  connectedAt?: TS;
  disconnectedAt?: TS;
  lastSeenAt?: TS;
  lastHeartbeatAt?: TS;
}

export type SessionStatus = "ACTIVE" | "ENDED";

export interface ChargeSession {
  id: string;
  chargePointId: string;
  transactionId: string;
  evseId?: number | null;
  connectorId?: number | null;
  status: SessionStatus;
  chargingState?: string | null;
  idToken?: string | null;
  startedAt?: TS;
  endedAt?: TS;
  lastUpdateAt?: TS;
  energyStartWh?: number;
  latestEnergyWh?: number;
  energyDeliveredWh?: number;
  stoppedReason?: string | null;
  /** Cumulative minutes spent in a non-"Charging" state (connected but idle) — what idle/parking fees are computed against. */
  idleMinutes?: number;
  /** Stamped by the OCPP server at session end, once a matching tariff is found. Absent if no tariff matched. */
  tariffId?: string | null;
  tariffName?: string | null;
  costBeforeGstInr?: number;
  gstPct?: number;
  gstInr?: number;
  parkingFeeInr?: number;
  idleFeeInr?: number;
  totalCostInr?: number;
  /** Set whenever the session's id token traces to an EMSP user — a durable "who charged" reference, independent of walletDebited (also set for a ₹0 or otherwise-unbilled session, which never triggers a debit). */
  emspUserId?: string;
  /** True only when the cost was actually auto-debited from a wallet. */
  walletDebited?: boolean;
  walletOwnerType?: "EMSP_USER" | "CORPORATE_ACCOUNT";
  walletOwnerId?: string;
  walletOwnerName?: string;
  /** Set when an active subscription discounted this session's totalCostInr — the % already applied, for display. */
  subscriptionDiscountPct?: number;
  /** Set once a manual discount is applied (see /api/sessions/discount) — the pre-discount totalCostInr, preserved for audit. */
  originalCostInr?: number;
  manualDiscountInr?: number;
  manualDiscountReason?: string;
  manualDiscountBy?: { uid: string; name: string; role: string };
  manualDiscountAt?: TS;
  /** Stamped at billing time, in minutes — a stored duration rather than one recomputed client-side from startedAt/endedAt each render. */
  durationMinutes?: number;
  /** Traced from the session's id token to the vehicle whose RFID card it is, if assigned (see fleets → vehicles). */
  vehicleId?: string | null;
  vehicleRegNumber?: string | null;
  vehicleLabel?: string | null;
  /**
   * The gateway payment that funded THIS session directly — only set by the
   * app-less QR pay-per-session flow (see api/public/qr-charge/*), where a
   * Razorpay payment is tied 1:1 to one session. A wallet-debited session
   * has no value here: it was funded by an earlier, separate top-up, not a
   * payment made at charge time.
   */
  paymentRef?: string | null;
  qrSession?: boolean;
}

function mapChargePoint(id: string, data: Record<string, unknown>): ChargePoint {
  return { id, ...(data as Omit<ChargePoint, "id">) };
}
function mapSession(id: string, data: Record<string, unknown>): ChargeSession {
  return { id, ...(data as Omit<ChargeSession, "id">) };
}

export function subscribeChargeSession(
  id: string,
  cb: (row: ChargeSession | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), CHARGE_SESSIONS, id),
    (snap) => cb(snap.exists() ? mapSession(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export function subscribeChargePoints(
  cb: (rows: ChargePoint[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGE_POINTS), orderBy("chargePointId", "asc")),
    (snap) => cb(snap.docs.map((d) => mapChargePoint(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeChargePoint(
  id: string,
  cb: (row: ChargePoint | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), CHARGE_POINTS, id),
    (snap) => cb(snap.exists() ? mapChargePoint(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

/** Every session currently ACTIVE, across all chargers — used to resolve a charger's live transactionId for a Remote Stop button. No orderBy, so no composite index needed. */
export function subscribeActiveSessions(
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGE_SESSIONS), where("status", "==", "ACTIVE")),
    (snap) => cb(snap.docs.map((d) => mapSession(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRecentSessions(
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
  max = 200,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGE_SESSIONS), orderBy("lastUpdateAt", "desc"), fsLimit(max)),
    (snap) => cb(snap.docs.map((d) => mapSession(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** Every session touched since `since` — used by the Earnings dashboard, uncapped unlike subscribeRecentSessions. */
export function subscribeSessionsSince(
  since: Date,
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), CHARGE_SESSIONS),
      where("lastUpdateAt", ">=", since),
      orderBy("lastUpdateAt", "desc"),
    ),
    (snap) => cb(snap.docs.map((d) => mapSession(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** All sessions auto-debited to a given wallet owner (retail user or corporate account) — no orderBy, so no composite index; sorted client-side. */
export function subscribeSessionsForWalletOwner(
  ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT",
  ownerId: string,
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), CHARGE_SESSIONS),
      where("walletOwnerType", "==", ownerType),
      where("walletOwnerId", "==", ownerId),
    ),
    (snap) => {
      const rows = snap.docs.map((d) => mapSession(d.id, d.data()));
      rows.sort((a, b) => {
        const am = (a.lastUpdateAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const bm = (b.lastUpdateAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return bm - am;
      });
      cb(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/** Sessions attributed to any of the given vehicles (via vehicleId — see billSession's RFID-card lookup). Firestore's "in" caps at 10 values, so only the first 10 vehicles are queried; fine for the fleet-usage report this feeds. */
export function subscribeSessionsForVehicles(
  vehicleIds: string[],
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
): () => void {
  if (vehicleIds.length === 0) {
    cb([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(getDb(), CHARGE_SESSIONS), where("vehicleId", "in", vehicleIds.slice(0, 10))),
    (snap) => cb(snap.docs.map((d) => mapSession(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeSessionsForChargePoint(
  chargePointId: string,
  cb: (rows: ChargeSession[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), CHARGE_SESSIONS),
      where("chargePointId", "==", chargePointId),
      orderBy("lastUpdateAt", "desc"),
      fsLimit(50),
    ),
    (snap) => cb(snap.docs.map((d) => mapSession(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** One entry per outage — written by the OCPP server the moment a charger reconnects. Feeds MTTR / historical-uptime reporting. */
export interface DowntimeEvent {
  id: string;
  chargePointId: string;
  disconnectedAt: TS;
  recoveredAt: TS;
  durationMinutes: number;
}

function mapDowntimeEvent(id: string, data: Record<string, unknown>): DowntimeEvent {
  return { id, ...(data as Omit<DowntimeEvent, "id">) };
}

export function subscribeDowntimeEventsSince(
  since: Date,
  cb: (rows: DowntimeEvent[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), DOWNTIME_EVENTS),
      where("recoveredAt", ">=", since),
      orderBy("recoveredAt", "desc"),
    ),
    (snap) => cb(snap.docs.map((d) => mapDowntimeEvent(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeDowntimeEventsForCharger(
  chargePointId: string,
  since: Date,
  cb: (rows: DowntimeEvent[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), DOWNTIME_EVENTS),
      where("chargePointId", "==", chargePointId),
      where("recoveredAt", ">=", since),
      orderBy("recoveredAt", "desc"),
    ),
    (snap) => cb(snap.docs.map((d) => mapDowntimeEvent(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** One entry per Call/CallResult/CallError crossing the wire — written by the OCPP server, read-only here. TTL-cleaned via expireAt. */
export interface OcppMessage {
  id: string;
  chargePointId: string;
  direction: "IN" | "OUT";
  messageType: "Call" | "CallResult" | "CallError";
  action: string | null;
  uniqueId: string;
  payload: string;
  createdAt: TS;
}

const OCPP_MESSAGES = "ocppMessages";

function mapOcppMessage(id: string, data: Record<string, unknown>): OcppMessage {
  return { id, ...(data as Omit<OcppMessage, "id">) };
}

/** Driver ratings/reviews submitted from the app-less QR charging page (see app/charge/[chargerId]) — public collection, read-only from here (writes only go through api/public/qr-charge/review). */
export function subscribeChargerReviews(
  chargePointId: string,
  cb: (rows: ChargerReview[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGER_REVIEWS), where("chargerId", "==", chargePointId), orderBy("createdAt", "desc"), fsLimit(50)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChargerReview, "id">) }))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeOcppMessagesForCharger(
  chargePointId: string,
  cb: (rows: OcppMessage[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), OCPP_MESSAGES),
      where("chargePointId", "==", chargePointId),
      orderBy("createdAt", "desc"),
      fsLimit(200),
    ),
    (snap) => cb(snap.docs.map((d) => mapOcppMessage(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
