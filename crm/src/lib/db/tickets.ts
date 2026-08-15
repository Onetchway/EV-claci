"use client";

/**
 * Fault/offline tickets. OFFLINE and FAULT tickets are opened by the OCPP
 * server (ocpp-server/src/tickets.ts) via the Admin SDK the moment it
 * observes a problem — this module only ever reads those, plus lets the
 * CRM's own users create a MANUAL one and manage any ticket's assignment/
 * status/SLA from there. Firestore rules enforce the type restriction on
 * create (see firebase/firestore.rules).
 */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import type { TicketStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Ticket } from "../types";

export const TICKETS = "tickets";

function mapTicket(id: string, data: Record<string, unknown>): Ticket {
  return { id, ...(data as Omit<Ticket, "id">) };
}

export function subscribeTickets(
  filters: { status?: TicketStatus; chargePointId?: string },
  cb: (rows: Ticket[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = [
    ...(filters.status ? [where("status", "==", filters.status)] : []),
    ...(filters.chargePointId ? [where("chargePointId", "==", filters.chargePointId)] : []),
  ];
  return onSnapshot(
    query(collection(getDb(), TICKETS), ...constraints, orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapTicket(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function createManualTicket(
  chargePointId: string,
  description: string,
  actor: Actor,
): Promise<void> {
  await addDoc(collection(getDb(), TICKETS), {
    chargePointId,
    type: "MANUAL",
    status: "OPEN",
    description,
    assignedTo: null,
    openedAt: serverTimestamp(),
    resolvedAt: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function updateTicketStatus(id: string, status: TicketStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, id), {
    status,
    resolvedAt: status === "RESOLVED" || status === "CLOSED" ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function assignTicket(id: string, assignee: Actor | null, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, id), {
    assignedTo: assignee,
    status: assignee ? "IN_PROGRESS" : "OPEN",
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}
