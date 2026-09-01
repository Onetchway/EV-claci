"use client";

/** Read-only client for `failedPayments` — written only by the Razorpay webhook route (Admin SDK) on `payment.failed`. See types.ts's FailedPayment doc comment. */

import { collection, limit as fsLimit, onSnapshot, orderBy, query } from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { FailedPayment } from "../types";

export const FAILED_PAYMENTS = "failedPayments";

function mapFailedPayment(id: string, data: Record<string, unknown>): FailedPayment {
  return { id, ...(data as Omit<FailedPayment, "id">) };
}

export function subscribeFailedPayments(
  cb: (rows: FailedPayment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), FAILED_PAYMENTS), orderBy("createdAt", "desc"), fsLimit(50)),
    (snap) => cb(snap.docs.map((d) => mapFailedPayment(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
