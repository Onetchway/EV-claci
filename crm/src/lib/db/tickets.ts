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
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import type { TicketFaultClass, TicketStatus } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import type { Actor, Ticket, TicketPart } from "../types";

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

/** Firestore rules restrict this to SUPER_ADMIN — fault/offline tickets are an operational history, not something most roles should be able to erase. */
export async function deleteTicket(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), TICKETS, id));
}

export async function setTicketFaultClass(id: string, faultClass: TicketFaultClass | null, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, id), { faultClass, updatedAt: serverTimestamp(), updatedBy: actor });
}

export async function setTicketRepairDetails(
  id: string,
  patch: { parts?: TicketPart[]; repairCostInr?: number },
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: actor });
}

/** Re-verifies the charger is actually working, then closes the ticket — distinct from just marking RESOLVED, which doesn't require that check. */
export async function verifyAndCloseTicket(id: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, id), {
    status: "CLOSED",
    resolvedAt: serverTimestamp(),
    verifiedAt: serverTimestamp(),
    verifiedBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function uploadTicketPhoto(ticketId: string, file: File, actor: Actor): Promise<void> {
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `tickets/${ticketId}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", undefined, reject, () => resolve());
  });
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(getDb(), TICKETS, ticketId), {
    photoUrls: arrayUnion(url),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function removeTicketPhoto(ticketId: string, url: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TICKETS, ticketId), {
    photoUrls: arrayRemove(url),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}
