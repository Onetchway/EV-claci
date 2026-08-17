"use client";

/** Manually logged odometer readings — the input needed to compute a fleet vehicle's cost-per-km, since there's no telematics integration reading actual mileage. */

import {
  addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, OdometerReading } from "../types";

export const ODOMETER_READINGS = "odometerReadings";

function mapReading(id: string, data: Record<string, unknown>): OdometerReading {
  return { id, ...(data as Omit<OdometerReading, "id">) };
}

export function subscribeOdometerReadings(
  vehicleIds: string[],
  cb: (rows: OdometerReading[]) => void,
  onError?: (e: Error) => void,
): () => void {
  if (vehicleIds.length === 0) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(getDb(), ODOMETER_READINGS), where("vehicleId", "in", vehicleIds.slice(0, 30)), orderBy("readingDate", "asc")),
    (snap) => cb(snap.docs.map((d) => mapReading(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function addOdometerReading(
  draft: { vehicleId: string; odometerKm: number; readingDate: Date; notes?: string },
  actor: Actor,
): Promise<void> {
  await addDoc(collection(getDb(), ODOMETER_READINGS), {
    ...draft,
    readingDate: Timestamp.fromDate(draft.readingDate),
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}
