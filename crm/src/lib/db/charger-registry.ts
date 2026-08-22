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
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { getBucket, getDb } from "../firebase/client";
import { logChangeSafe } from "./change-log";
import type { Actor, RevenueShareType, TS } from "../types";

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
  /** Manually recorded at registration — the live chargePoints record also gets a serialNumber from the charger's own BootNotification once connected; this is the pre-registration value from the OEM spec sheet. */
  serialNumber?: string;
  /** Manually recorded — OCPP 2.0.1's BootNotification payload has no hardware-version field, so this can never be auto-populated from the wire. */
  hardwareVersion?: string;
  /** SIM ICCID or modem IMEI, off the OEM spec sheet — informational, not used for connectivity. */
  simImei?: string;
  installationDate?: TS | null;
  warrantyStart?: TS | null;
  warrantyEnd?: TS | null;
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

  /** A photo of the physical unit, shown on its detail page. */
  photoUrl?: string | null;
  /** Whether this charger is bookable in advance — OCPP 2.0.1 ReserveNow/CancelReservation. Off by default; most sites don't want walk-up chargers held. */
  reservationsEnabled?: boolean;
  /** Restricts this charger from the public map/directory — still fully manageable here, just not advertised. */
  accessType?: "PUBLIC" | "PRIVATE";
  open24Hours?: boolean;
  /** Free text, e.g. "6 AM – 11 PM" — only meaningful when open24Hours is false. */
  openingHours?: string;
  /** Sent as the HeartbeatInterval in BootNotification's response — how often the charger should check in. Defaults to 300s (5 min) server-side if unset. */
  heartbeatIntervalSec?: number;
  /** A vehicle's target state of charge for a SetChargingProfile-based charge limit — 100 (no limit) if unset. */
  maxSocPercent?: number;
  /** A shared secret appended to this charger's WebSocket URL as ?token=... — a lightweight connection-auth layer on top of the charger-ID allow-list, short of full OCPP Security Profile certificates. */
  connectionToken?: string;
  /** The white-label tenant this charger counts against for license-quota purposes — set from the registering staff member's own Organization at creation time, never user-editable. Null/absent = the default (Livanto's own) organisation, which is never quota-checked. */
  orgId?: string | null;

  /**
   * Self-serve registration (see registerOwnCharger below) — a charger
   * owner who isn't CRM staff submits their own charger and the %/₹-per-kWh
   * rate they want, but it stays `active: false` (invisible to the OCPP
   * server's connect check) until Admin/Ops reviews and approves it. Absent
   * on every admin-registered charger, which was never pending in the first
   * place.
   */
  pendingApproval?: boolean;
  ownerRequestedRevShareType?: RevenueShareType;
  ownerRequestedRevShareValue?: number;
  approvedAt?: TS;
  approvedBy?: Actor | null;
  rejectedAt?: TS;
  rejectedReason?: string;

  /**
   * "STANDARD" (default, and the only behavior before this existed) — this
   * charger is billed by whatever tariff normally resolves for it
   * (ALL_CHARGERS / ZONE / CITY / STATE, per ocpp-server's tariff.ts
   * specificity order). "CUSTOM" — this charger has its own price, kept as
   * a real Tariff doc (scope SPECIFIC_CHARGERS, see customTariffId) that
   * naturally outranks any broader-scope tariff — no separate pricing
   * engine, just a friendlier per-charger entry point onto the existing one.
   */
  tariffMode?: "STANDARD" | "CUSTOM";
  /** The Tariff doc id backing tariffMode === "CUSTOM" — created on first use, deactivated (not deleted, so the rate history survives) if tariffMode reverts to STANDARD, reactivated if it's switched back. */
  customTariffId?: string | null;

  /**
   * Per-charger override of this charger's zone/site-wide revenue-share
   * settings — unset/false means "use the zone's settings" (the only
   * behavior before this existed). Same field shapes as Zone's equivalent
   * fields, just scoped to one charger instead of the whole site — useful
   * when one charger at a site is financed/owned differently than the rest
   * (e.g. a single fast charger a different partner put in).
   */
  revenueShareOverride?: boolean;
  revenueShareType?: RevenueShareType;
  revenueShareValue?: number;
  electricityCostPerKwh?: number;
  revenueShareHybridPct?: number;
}

/** Display name for a registration's manufacturer — the free-text override when vendor is "Other". */
export function oemLabel(r: Pick<ChargerRegistration, "vendor" | "vendorOther">): string {
  return r.vendor === "Other" && r.vendorOther?.trim() ? r.vendorOther : r.vendor;
}

export type ChargerRegistrationDraft = Omit<
  ChargerRegistration,
  | "id" | "chargerId" | "active" | "createdAt" | "createdBy" | "installationDate" | "warrantyStart" | "warrantyEnd" | "connectionToken"
  // System-managed — set only via the tariff upsert flow in the /chargers form, never a plain field edit.
  | "customTariffId"
> & {
  installationDate?: Date | null;
  warrantyStart?: Date | null;
  warrantyEnd?: Date | null;
};

/** Converts any of the three date fields present on the object from a plain Date to a Timestamp — omitted keys are left out entirely, so a partial update (e.g. just moving a pin) never blanks out warranty dates it wasn't given. */
function draftDatesToTimestamps<T extends Partial<ChargerRegistrationDraft>>(draft: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...draft };
  if ("installationDate" in draft) out.installationDate = draft.installationDate ? Timestamp.fromDate(draft.installationDate) : null;
  if ("warrantyStart" in draft) out.warrantyStart = draft.warrantyStart ? Timestamp.fromDate(draft.warrantyStart) : null;
  if ("warrantyEnd" in draft) out.warrantyEnd = draft.warrantyEnd ? Timestamp.fromDate(draft.warrantyEnd) : null;
  return out;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "charger";
}

/** Case preserved deliberately — a hardware charger's or simulator's Central System path is often case-sensitive, unlike the auto-generated slug below. */
function sanitizeCustomChargerId(id: string): string {
  return id.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
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

/** Chargers already linked to a lead (see leadId/leadCode above) — for the lead detail page's "Charging stations" card. */
export function subscribeChargerRegistryForLead(
  leadId: string,
  cb: (rows: ChargerRegistration[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CHARGER_REGISTRY), where("leadId", "==", leadId)),
    (snap) => cb(snap.docs.map((d) => mapDoc(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeChargerRegistration(
  id: string,
  cb: (row: ChargerRegistration | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), CHARGER_REGISTRY, id),
    (snap) => cb(snap.exists() ? mapDoc(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

/** Returns the generated chargerId — the caller needs it immediately to render the QR/URL. */
/** A per-charger shared secret for the connection-auth token — not cryptographically sensitive enough to need a server round-trip, just needs to be unguessable. */
function generateConnectionToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * customChargerId lets an admin pin the exact ID a physical charger or a
 * test simulator already has baked into its own config, instead of always
 * getting a random auto-generated one the hardware can never be made to
 * match. Must be globally unique; the caller sees a thrown Error if not.
 */
export async function registerCharger(
  draft: ChargerRegistrationDraft,
  actor: Actor,
  customChargerId?: string,
  orgId?: string | null,
): Promise<{ id: string; chargerId: string; connectionToken: string }> {
  let chargerId: string;
  if (customChargerId?.trim()) {
    chargerId = sanitizeCustomChargerId(customChargerId);
    if (!chargerId) throw new Error("Charger ID must contain at least one letter, number, hyphen or underscore.");
    const existing = await getDocs(
      query(collection(getDb(), CHARGER_REGISTRY), where("chargerId", "==", chargerId), fsLimit(1)),
    );
    if (!existing.empty) throw new Error(`Charger ID "${chargerId}" is already registered.`);
  } else {
    chargerId = `${slugify(draft.label)}-${uniqueSuffix()}`;
  }

  if (orgId) await assertUnderLicenseQuota(orgId, draft.chargerPowerType);

  const connectionToken = generateConnectionToken();
  const ref = await addDoc(collection(getDb(), CHARGER_REGISTRY), {
    ...draftDatesToTimestamps(draft),
    chargerId,
    active: true,
    connectionToken,
    orgId: orgId ?? null,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  logChangeSafe({ entityType: "CHARGER", entityId: ref.id, entityLabel: draft.label, action: "CREATE", actor });
  return { id: ref.id, chargerId, connectionToken };
}

export interface SelfServeChargerDraft {
  label: string;
  location: string;
  city?: string;
  state?: string;
  chargerPowerType: ChargerPowerType;
  connectorType?: ConnectorTypeName;
  powerKw?: number;
  vendor: ChargerVendor;
  vendorOther?: string;
  notes?: string;
  /** What the owner wants to be paid — a % of each session's post-GST total, or a flat ₹/kWh. Reviewed, not auto-applied: Admin/Ops sets the final rate on approval, which may differ from the request. */
  requestedRevShareType: RevenueShareType;
  requestedRevShareValue: number;
}

/**
 * Lets a charger owner who isn't CRM staff register their own hardware and
 * name the rate they want — the "Option to add charger by any user... we
 * will take %/kWh rate set in system" self-serve flow. Firestore rules only
 * let a SITE_OWNER-role account create a chargerRegistry doc when it's
 * `active: false, pendingApproval: true` (see firestore.rules) — this
 * function can't set anything else, and can't flip either flag itself, so
 * the charger genuinely cannot accept a real session (ocpp-server's
 * isRegisteredAndActive check requires `active === true`) until Admin/Ops
 * reviews it via approveSelfServeCharger below. A matching Zone is created
 * alongside it (owned by the same uid) so Station Management, Settlements,
 * and the revenue-share engine all have a site to attach to, exactly as if
 * staff had set one up — this function just can't touch the site's
 * revenue-share fields until an approval sets them from the reviewed rate.
 */
export async function registerOwnCharger(draft: SelfServeChargerDraft, actor: Actor): Promise<{ chargerId: string }> {
  const zoneRef = await addDoc(collection(getDb(), "zones"), {
    name: draft.label,
    maxLoadKw: draft.powerKw ?? 7,
    address: draft.location,
    city: draft.city ?? null,
    state: draft.state ?? null,
    ownerUid: actor.uid,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });

  const chargerId = `${slugify(draft.label)}-${uniqueSuffix()}`;
  const connectionToken = generateConnectionToken();
  await addDoc(collection(getDb(), CHARGER_REGISTRY), {
    chargerId,
    label: draft.label,
    location: draft.location,
    state: draft.state ?? null,
    chargerPowerType: draft.chargerPowerType,
    connectorType: draft.connectorType ?? null,
    powerKw: draft.powerKw ?? null,
    vendor: draft.vendor,
    vendorOther: draft.vendorOther ?? null,
    notes: draft.notes ?? null,
    zoneId: zoneRef.id,
    active: false,
    pendingApproval: true,
    ownerRequestedRevShareType: draft.requestedRevShareType,
    ownerRequestedRevShareValue: draft.requestedRevShareValue,
    connectionToken,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return { chargerId };
}

/** Admin/Ops-only (enforced by firestore.rules — SITE_OWNER can only create, never update). Activates the charger and applies the reviewed rate to its zone. finalRevShare lets the reviewer approve at a different rate than requested. */
export async function approveSelfServeCharger(
  registration: Pick<ChargerRegistration, "id" | "zoneId">,
  finalRevShare: { type: RevenueShareType; value: number },
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, registration.id), {
    active: true,
    pendingApproval: false,
    approvedAt: serverTimestamp(),
    approvedBy: actor,
  });
  if (registration.zoneId) {
    await updateDoc(doc(getDb(), "zones", registration.zoneId), {
      revenueShareType: finalRevShare.type,
      revenueShareValue: finalRevShare.value,
    });
  }
}

export async function rejectSelfServeCharger(id: string, reason: string): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), {
    pendingApproval: false,
    rejectedAt: serverTimestamp(),
    rejectedReason: reason,
  });
}

/** Throws if registering one more charger of this power type would exceed the tenant's license quota. Unlimited (no throw) when the org has no quota set for that type. */
async function assertUnderLicenseQuota(orgId: string, powerType: ChargerPowerType): Promise<void> {
  const orgSnap = await getDoc(doc(getDb(), "organizations", orgId));
  if (!orgSnap.exists()) return;
  const org = orgSnap.data() as { name?: string; acLicenseTotal?: number; dcLicenseTotal?: number };
  const quota = powerType === "AC" ? org.acLicenseTotal : org.dcLicenseTotal;
  if (!quota || quota <= 0) return;

  const existing = await getDocs(
    query(
      collection(getDb(), CHARGER_REGISTRY),
      where("orgId", "==", orgId),
      where("chargerPowerType", "==", powerType),
      where("active", "==", true),
    ),
  );
  if (existing.size >= quota) {
    throw new Error(
      `${org.name ?? "This organisation"} has used all ${quota} ${powerType} charger licenses. Contact your platform admin to increase the quota.`,
    );
  }
}

/** Rotates a charger's connection token — the old one stops working immediately, so the charger must be reconfigured with the new URL. */
export async function regenerateConnectionToken(id: string): Promise<string> {
  const token = generateConnectionToken();
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { connectionToken: token });
  return token;
}

export async function uploadChargerPhoto(id: string, file: File): Promise<void> {
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `chargers/${id}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", undefined, reject, () => resolve());
  });
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { photoUrl: url });
}

export async function updateChargerRegistration(
  id: string,
  patch: Partial<ChargerRegistrationDraft>,
  actor?: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), draftDatesToTimestamps(patch));
  if (actor) logChangeSafe({ entityType: "CHARGER", entityId: id, entityLabel: patch.label ?? id, action: "UPDATE", actor });
}

/** Links (or unlinks, with null) this charger's custom Tariff doc — kept out of updateChargerRegistration's normal patch surface since it's only ever set as a side effect of the tariff-upsert flow, not a plain form field. */
export async function setChargerCustomTariffId(id: string, customTariffId: string | null): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { customTariffId });
}

/**
 * Deactivates rather than deletes: the OCPP server checks `active` before
 * accepting a connection, so this is the actual "revoke access" action — a
 * hard delete would work too, but keeping the record preserves history
 * (which chargers were ever provisioned, by whom).
 */
export async function setChargerActive(id: string, active: boolean, actor?: Actor, label?: string): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_REGISTRY, id), { active });
  if (actor) logChangeSafe({ entityType: "CHARGER", entityId: id, entityLabel: label ?? id, action: active ? "ACTIVATE" : "DEACTIVATE", actor });
}

/** Hard delete — unlike setChargerActive(false), this removes the record entirely and can't be undone from the CRM. */
export async function deleteChargerRegistration(id: string, actor?: Actor, label?: string): Promise<void> {
  await deleteDoc(doc(getDb(), CHARGER_REGISTRY, id));
  if (actor) logChangeSafe({ entityType: "CHARGER", entityId: id, entityLabel: label ?? id, action: "DELETE", actor });
}

export function chargerWsUrl(serverHost: string, chargerId: string, connectionToken?: string): string {
  const base = `wss://${serverHost}/ocpp/${chargerId}`;
  return connectionToken ? `${base}?token=${connectionToken}` : base;
}
