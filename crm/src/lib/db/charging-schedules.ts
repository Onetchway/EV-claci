"use client";

/**
 * Depot/fleet scheduled charging — a future-dated remote start instead of a
 * walk-up RFID tap. The CRM only creates/cancels rows here; ocpp-server
 * (see depot-scheduling.ts) sweeps for due schedules and fires the actual
 * RequestStartTransaction, then marks TRIGGERED/FAILED.
 */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, ChargingSchedule } from "../types";

export const CHARGING_SCHEDULES = "chargingSchedules";

function mapSchedule(id: string, data: Record<string, unknown>): ChargingSchedule {
  return { id, ...(data as Omit<ChargingSchedule, "id">) };
}

export function subscribeChargingSchedules(
  cb: (rows: ChargingSchedule[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGING_SCHEDULES), orderBy("scheduledStartAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapSchedule(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export interface ChargingScheduleDraft {
  chargerId: string;
  evseId: number;
  vehicleId?: string | null;
  vehicleRegNumber?: string | null;
  fleetId?: string | null;
  idToken: string;
  idTokenLabel?: string;
  scheduledStartAt: Date;
}

export async function createChargingSchedule(draft: ChargingScheduleDraft, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), CHARGING_SCHEDULES), {
    ...draft,
    scheduledStartAt: Timestamp.fromDate(draft.scheduledStartAt),
    status: "SCHEDULED",
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function cancelChargingSchedule(id: string): Promise<void> {
  await updateDoc(doc(getDb(), CHARGING_SCHEDULES, id), { status: "CANCELLED" });
}

/** Everything still pending for a specific charger — used by the charger detail page. */
export function subscribeChargingSchedulesForCharger(
  chargerId: string,
  cb: (rows: ChargingSchedule[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGING_SCHEDULES), where("chargerId", "==", chargerId), orderBy("scheduledStartAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapSchedule(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
