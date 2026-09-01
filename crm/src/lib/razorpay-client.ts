"use client";

/**
 * Triggers Razorpay's hosted Checkout for a wallet top-up. Loads
 * checkout.js on demand (not bundled — it's an external script Razorpay
 * serves) rather than at app startup, since most sessions never open it.
 */

import { getFirebaseAuth } from "./firebase/client";
import type { WalletOwnerType } from "./types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Razorpay checkout — check your connection."));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function refundTopup(
  walletTransactionId: string,
  amountInr?: number,
): Promise<{ ok: true; refundId: string; refundedInr: number; fullyRefunded: boolean }> {
  return authedFetch("/api/payments/razorpay/refund", { walletTransactionId, amountInr }) as Promise<
    { ok: true; refundId: string; refundedInr: number; fullyRefunded: boolean }
  >;
}

async function authedFetch(path: string, body: unknown) {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

export interface WalletTopupResult {
  ok: true;
  bonusInr?: number;
  newBalanceInr?: number;
  razorpayPaymentId?: string;
}

/** Opens Razorpay Checkout for a wallet top-up; resolves once the payment is verified server-side, rejects on failure or cancellation. */
export function topUpWallet(opts: {
  ownerType: WalletOwnerType;
  ownerId: string;
  ownerName: string;
  amountInr: number;
  couponCode?: string;
}): Promise<WalletTopupResult> {
  return new Promise((resolve, reject) => {
    (async () => {
      await loadCheckoutScript();
      const order = await authedFetch("/api/payments/razorpay/order", {
        ownerType: opts.ownerType, ownerId: opts.ownerId, amountInr: opts.amountInr,
      });

      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Livanto Green — Wallet top-up",
        description: opts.ownerName,
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          void authedFetch("/api/payments/razorpay/verify", {
            ownerType: opts.ownerType,
            ownerId: opts.ownerId,
            amountInr: opts.amountInr,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            couponCode: opts.couponCode || undefined,
          }).then((res) => resolve({
            ok: true, bonusInr: res.bonusInr, newBalanceInr: res.newBalanceInr, razorpayPaymentId: response.razorpay_payment_id,
          })).catch(reject);
        },
        modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
      });
      rzp.open();
    })().catch(reject);
  });
}
