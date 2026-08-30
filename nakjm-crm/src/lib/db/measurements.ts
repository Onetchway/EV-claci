"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Measurement } from "../types";
import { logActivitySafe } from "./activity";

export const MEASUREMENTS = "measurements";

function mapMeasurement(id: string, data: Record<string, unknown>): Measurement {
  return { id, ...(data as Omit<Measurement, "id">) };
}

export function subscribeMeasurementsForProject(projectId: string, cb: (rows: Measurement[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), MEASUREMENTS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapMeasurement(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/**
 * One doc per BOQ line item, deterministic id so re-recording the same item
 * updates in place instead of duplicating — the BOQ itself is the planned
 * quantity, this collection only tracks what's been executed against it.
 */
export async function recordMeasurement(
  args: { projectId: string; boqId: string; itemSrNo: number; description: string; unit?: string; boqQty: number; executedQty: number },
  actor: Actor,
): Promise<void> {
  const id = `${args.boqId}_${args.itemSrNo}`;
  await setDoc(doc(getDb(), MEASUREMENTS, id), {
    projectId: args.projectId,
    boqId: args.boqId,
    itemSrNo: args.itemSrNo,
    description: args.description,
    unit: args.unit ?? "",
    boqQty: args.boqQty,
    executedQty: args.executedQty,
    updatedAt: serverTimestamp(),
    updatedById: actor.uid,
    updatedByName: actor.name,
  }, { merge: true });
  logActivitySafe({
    entityType: "MEASUREMENT", entityId: id, entityLabel: args.description, action: "UPDATE",
    message: `Recorded ${args.executedQty}${args.unit ? ` ${args.unit}` : ""} executed for ${args.description}`,
    actor, projectId: args.projectId,
  });
}
