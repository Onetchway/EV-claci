/**
 * Fault detection → ticket creation. This server is the only thing that
 * knows a charger's real-time connection/fault state, so it's the natural
 * place to open a ticket — the CRM then owns triage, assignment and status
 * from there (see crm/src/lib/db/tickets.ts, a normal Firestore-rules-gated
 * collection for the humans working the ticket).
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { dispatchWebhookSafe } from "./webhooks.js";

export const TICKETS = "tickets";

/** Hours before an open ticket is considered SLA-breached — a flat default for Phase 2, not yet per-site. */
const SLA_HOURS = Number(process.env.FAULT_SLA_HOURS) || 4;

/** Missed-heartbeat window before an ONLINE charger is swept to OFFLINE + ticketed. */
export const OFFLINE_SWEEP_MS = Number(process.env.OFFLINE_SWEEP_MS) || 6 * 60 * 1000;

export type TicketType = "OFFLINE" | "FAULT" | "MANUAL";

const NOTIFY_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

/** Notifies every CRM user whose role (primary or additional) can act on a ticket — best-effort, never blocks ticket creation. */
async function notifyTicketOpened(chargePointId: string, type: TicketType, description: string): Promise<void> {
  try {
    const [byPrimary, byRoles] = await Promise.all([
      db().collection("users").where("role", "in", NOTIFY_ROLES).get(),
      db().collection("users").where("roles", "array-contains-any", NOTIFY_ROLES).get(),
    ]);
    const uids = new Map<string, void>();
    for (const d of [...byPrimary.docs, ...byRoles.docs]) uids.set(d.id, undefined);

    const batch = db().batch();
    for (const uid of uids.keys()) {
      const ref = db().collection("notifications").doc();
      batch.set(ref, {
        uid,
        title: `${type === "OFFLINE" ? "Charger offline" : type === "FAULT" ? "Charger fault" : "Ticket opened"}: ${chargePointId}`,
        body: description,
        href: "/tickets",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    console.error("[tickets] failed to notify ticket recipients", err);
  }
}

/** Looks up a per-site SLA override (Zones.slaHours in the CRM) via the charger's registered zoneId — falls back to the flat default when unset. */
async function slaHoursFor(chargePointId: string): Promise<number> {
  const reg = await db()
    .collection("chargerRegistry")
    .where("chargerId", "==", chargePointId)
    .limit(1)
    .get();
  const zoneId = reg.empty ? null : (reg.docs[0]!.data().zoneId as string | null | undefined);
  if (!zoneId) return SLA_HOURS;
  const zoneSnap = await db().collection("zones").doc(zoneId).get();
  const override = zoneSnap.data()?.slaHours as number | undefined;
  return override && override > 0 ? override : SLA_HOURS;
}

/**
 * Opens a ticket unless one of the same type is already OPEN/IN_PROGRESS for
 * this charger — repeated faults on an already-ticketed charger shouldn't
 * spam a new ticket per event.
 */
export async function openTicketIfNeeded(
  chargePointId: string,
  type: TicketType,
  description: string,
): Promise<void> {
  const existing = await db()
    .collection(TICKETS)
    .where("chargePointId", "==", chargePointId)
    .where("type", "==", type)
    .where("status", "in", ["OPEN", "IN_PROGRESS"])
    .limit(1)
    .get();
  if (!existing.empty) return;

  const now = Date.now();
  const slaHours = await slaHoursFor(chargePointId);
  await db().collection(TICKETS).add({
    chargePointId,
    type,
    status: "OPEN",
    description,
    assignedTo: null,
    openedAt: FieldValue.serverTimestamp(),
    slaDueAt: new Date(now + slaHours * 60 * 60 * 1000),
    resolvedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  void notifyTicketOpened(chargePointId, type, description);
  dispatchWebhookSafe("ticket.opened", { chargePointId, type, description });
}

/**
 * Run periodically: any charger still marked ONLINE but silent past the
 * sweep window has effectively gone offline without a clean disconnect
 * (e.g. it lost power mid-connection) — mark it and open a ticket.
 */
export async function sweepStaleConnections(): Promise<void> {
  const cutoff = new Date(Date.now() - OFFLINE_SWEEP_MS);
  const snap = await db()
    .collection("chargePoints")
    .where("status", "==", "ONLINE")
    .where("lastSeenAt", "<", cutoff)
    .get();

  for (const doc of snap.docs) {
    await doc.ref.set(
      { status: "OFFLINE", disconnectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await openTicketIfNeeded(doc.id, "OFFLINE", `No heartbeat received for over ${Math.round(OFFLINE_SWEEP_MS / 60000)} minutes.`);
  }
}
