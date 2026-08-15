/**
 * Fault detection → ticket creation. This server is the only thing that
 * knows a charger's real-time connection/fault state, so it's the natural
 * place to open a ticket — the CRM then owns triage, assignment and status
 * from there (see crm/src/lib/db/tickets.ts, a normal Firestore-rules-gated
 * collection for the humans working the ticket).
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";

export const TICKETS = "tickets";

/** Hours before an open ticket is considered SLA-breached — a flat default for Phase 2, not yet per-site. */
const SLA_HOURS = Number(process.env.FAULT_SLA_HOURS) || 4;

/** Missed-heartbeat window before an ONLINE charger is swept to OFFLINE + ticketed. */
export const OFFLINE_SWEEP_MS = Number(process.env.OFFLINE_SWEEP_MS) || 6 * 60 * 1000;

export type TicketType = "OFFLINE" | "FAULT" | "MANUAL";

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
  await db().collection(TICKETS).add({
    chargePointId,
    type,
    status: "OPEN",
    description,
    assignedTo: null,
    openedAt: FieldValue.serverTimestamp(),
    slaDueAt: new Date(now + SLA_HOURS * 60 * 60 * 1000),
    resolvedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
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
