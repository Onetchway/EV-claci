"use client";

/** Fleet operators: fleets, their vehicles, and their drivers. */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Driver, Fleet, Vehicle } from "../types";

export const FLEETS = "fleets";
export const VEHICLES = "vehicles";
export const DRIVERS = "drivers";

function mapFleet(id: string, data: Record<string, unknown>): Fleet {
  return { id, ...(data as Omit<Fleet, "id">) };
}
function mapVehicle(id: string, data: Record<string, unknown>): Vehicle {
  return { id, ...(data as Omit<Vehicle, "id">) };
}
function mapDriver(id: string, data: Record<string, unknown>): Driver {
  return { id, ...(data as Omit<Driver, "id">) };
}

export function subscribeFleets(
  cb: (rows: Fleet[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), FLEETS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapFleet(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function createFleet(
  draft: { name: string; corporateAccountId?: string | null },
  actor: Actor,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), FLEETS), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export function subscribeVehicles(
  fleetId: string,
  cb: (rows: Vehicle[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), VEHICLES), where("fleetId", "==", fleetId), orderBy("regNumber", "asc")),
    (snap) => cb(snap.docs.map((d) => mapVehicle(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type VehicleDraft = Omit<Vehicle, "id" | "createdAt" | "createdBy">;

export async function createVehicle(draft: VehicleDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), VEHICLES), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export function subscribeDrivers(
  fleetId: string,
  cb: (rows: Driver[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), DRIVERS), where("fleetId", "==", fleetId), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapDriver(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type DriverDraft = Omit<Driver, "id" | "createdAt" | "createdBy">;

export async function createDriver(draft: DriverDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), DRIVERS), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function assignVehicleDriver(vehicleId: string, driverId: string | null): Promise<void> {
  await updateDoc(doc(getDb(), VEHICLES, vehicleId), { assignedDriverId: driverId });
}

/** Assigns the RFID card that lives in a vehicle, so the OCPP server can attribute charging sessions back to it. */
export async function assignVehicleRfidToken(vehicleId: string, rfidTokenId: string | null): Promise<void> {
  await updateDoc(doc(getDb(), VEHICLES, vehicleId), { rfidTokenId });
}

export async function updateFleet(id: string, patch: { name: string; corporateAccountId?: string | null }): Promise<void> {
  await updateDoc(doc(getDb(), FLEETS, id), { ...patch });
}

export async function deleteFleet(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), FLEETS, id));
}

export async function deleteVehicle(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), VEHICLES, id));
}

export async function deleteDriver(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), DRIVERS, id));
}

/** Finds the fleet driver record (if any) linked to a given EMSP user — the join for a unified customer/driver profile. */
export function subscribeDriverForEmspUser(
  emspUserId: string,
  cb: (row: Driver | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), DRIVERS), where("emspUserId", "==", emspUserId)),
    (snap) => cb(snap.empty ? null : mapDriver(snap.docs[0]!.id, snap.docs[0]!.data())),
    (err) => onError?.(err as Error),
  );
}

export function subscribeVehiclesForDriver(
  driverId: string,
  cb: (rows: Vehicle[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), VEHICLES), where("assignedDriverId", "==", driverId)),
    (snap) => cb(snap.docs.map((d) => mapVehicle(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
