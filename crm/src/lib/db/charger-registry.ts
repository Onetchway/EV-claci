"use client";

/**
 * Admin-entered charger registrations — the source of truth for which
 * charger IDs are allowed to connect to the OCPP central system at all.
 *
 * Deliberately a separate collection from chargePoints/chargeSessions
 * (lib/db/chargers.ts), which only the OCPP server ever writes: this one is
 * written by the CRM (an admin registering a new charger), and *read* by the
 * OCPP server (via the Admin SDK) to decide whether to accept a connection.
 * Registering here doesn't mean the charger is online — chargePoints still
 * carries that live telemetry, joined by chargerId in the /chargers UI.
 */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, TS } from "../types";

export const CHARGER_REGISTRY = "chargerRegistry";

export const CHARGER_VENDORS = ["Exicom", "Everta", "Mindra", "Other"] as const;
export type ChargerVendor = (typeof CHARGER_VENDORS)[number];

export const CHARGER_TYPES = ["AC", "DC"] as const;
export type ChargerPowerType = (typeof CHARGER_TYPES)[number];

export const CONNECTOR_TYPES = ["Type 2", "CCS2", "CHAdeMO", "GB/T", "Bharat AC-001", "Bharat DC-001"] as const;
export type ConnectorTypeName = (typeof CONNECTOR_TYPES)[number];

/**
 * A single physical gun on a multi-connector EVSE (e.g. a DC charger with
 * both a CCS2 and a CHAdeMO gun sharing one power cabinet). connectorId
 * matches the OCPP connectorId reported in chargePoints' live `connectors`
 * map, so the registration spec can be joined with live status per-gun.
 */
export interface ChargerConnector {
  connectorId: number;
  connectorType: ConnectorTypeName;
  powerKw?: number;
}

export interface ChargerRegistration {
  id: string;
  /** The path segment the charger's Central System URL is keyed by. Immutable once set. */
  chargerId: string;
  label: string;
  location: string;
  state?: string;
  chargerPowerType: ChargerPowerType;
  vendor: ChargerVendor;
  /** Free-text OEM name, used (and shown instead of `vendor`) when vendor === "Other". */
  vendorOther?: string;
  model?: string;
  /** Connector 1's type/power — kept for single-gun chargers (the common case) and as a fallback. */
  connectorType?: ConnectorTypeName;
  powerKw?: number;
  /** Set only for multi-gun EVSEs (2+ connectors) — each with its own type/power. Absent means single-connector, use connectorType/powerKw above. */
  connectors?: ChargerConnector[];
  notes?: string;
  zoneId?: string | null;
  /** Manually entered — no geocoding dependency, so no Maps API key is required. */
  lat?: number | null;
  lng?: number | null;
  /** Optional link to the EPC/RWA/Software (etc.) lead this charger belongs to. */
  leadId?: string | null;
  leadCode?: string | null;
  active: boolean;
  createdAt?: TS;
  createdBy?: Actor;
}

/** Display name for a registration's manufacturer — the free-text override when vendor is "Other". */
export function oemLabel(r: Pick<ChargerRegistration, "vendor" | "vendorOther">): string {
  return r.vendor === "Other" && r.vendorOther?.trim() ? r.vendorOther : r.vendor;
}

export type ChargerRegistrationDraft = Omit<ChargerRegistration, "id" | "chargerId" | "active" | "createdAt" | "createdBy">;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "charger";
}

/** Short, human-glanceable, and collision-resistant without a Firestore read. */
function uniqueSuffix(): string {
  return Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);
}

function mapDoc(id: string, data: Record<string, unknown>): ChargerRegistration {
  const d = data as Omit<ChargerRegistration, "id">;
  return { ...d, id, active: d.active ?? true };
}

export function subscribeChargerRegistry(
  cb: (rows: ChargerRegistration[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGER_REGISTRY), orderBy("label", "asc")),
    (snap) => cb(snap.docs.map((d) => mapDoc(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** Returns the generated chargerId — the caller needs it immediately to render the QR/URL. */
export async function registerCharger(draft: ChargerRegistrationDraft, actor: Actor): Promise<string> {
  const chargerId = `${slugify(draft.label)}-${uniqueSuffix()}`;
  await addDoc(collection(getDb(), CHARGER_REGISTRY), {
    ...draft,
    chargerId,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return chargerId;
}

export async function updateChargerRegistration(
  id: string,
  patch: Partial<Pick<ChargerRegistration,
    "label" | "location" | "state" | "chargerPowerType" | "vendor" | "vendorOther" | "model" | "connectorType" |
    "powerKw" | "connectors" | "notes" | "zoneId" | "lat" | "lng" | "leadId" | "leadCode"
  >>,
): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { ...patch });
}

/**
 * Deactivates rather than deletes: the OCPP server checks `active` before
 * accepting a connection, so this is the actual "revoke access" action — a
 * hard delete would work too, but keeping the record preserves history
 * (which chargers were ever provisioned, by whom).
 */
export async function setChargerActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { active });
}

export function chargerWsUrl(serverHost: string, chargerId: string): string {
  return `wss://${serverHost}/ocpp/${chargerId}`;
}
