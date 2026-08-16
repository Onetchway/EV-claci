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
import type { TS } from "../types";

export const CHARGE_POINTS = "chargePoints";
export const CHARGE_SESSIONS = "chargeSessions";

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
  connectors?: Record<string, ConnectorState>;
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
  /** Set when the session's id token was traced to an EMSP user/corporate account and the cost was auto-debited from their wallet. */
  walletDebited?: boolean;
  walletOwnerType?: "EMSP_USER" | "CORPORATE_ACCOUNT";
  walletOwnerId?: string;
  walletOwnerName?: string;
  /** Set when an active subscription discounted this session's totalCostInr — the % already applied, for display. */
  subscriptionDiscountPct?: number;
}

function mapChargePoint(id: string, data: Record<string, unknown>): ChargePoint {
  return { id, ...(data as Omit<ChargePoint, "id">) };
}
function mapSession(id: string, data: Record<string, unknown>): ChargeSession {
  return { id, ...(data as Omit<ChargeSession, "id">) };
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
