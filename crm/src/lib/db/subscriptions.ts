"use client";

/**
 * Subscription plans (staff-authored) and EMSP users' subscriptions to
 * them. Subscribing debits the plan's monthly price from the user's wallet
 * immediately (same postpaid, allow-negative philosophy as session
 * billing) — the actual discount at session time and the automatic
 * monthly renewal both happen in ocpp-server (see
 * ocpp-server/src/subscriptions.ts), this module only manages the records.
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, EmspUser, SubscriptionPlan, UserSubscription } from "../types";

export const SUBSCRIPTION_PLANS = "subscriptionPlans";
export const USER_SUBSCRIPTIONS = "userSubscriptions";
export const WALLET_TRANSACTIONS = "walletTransactions";
export const EMSP_USERS = "emspUsers";

function mapPlan(id: string, data: Record<string, unknown>): SubscriptionPlan {
  return { id, ...(data as Omit<SubscriptionPlan, "id">) };
}
function mapSub(id: string, data: Record<string, unknown>): UserSubscription {
  return { id, ...(data as Omit<UserSubscription, "id">) };
}

export function subscribePlans(
  cb: (rows: SubscriptionPlan[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), SUBSCRIPTION_PLANS), orderBy("monthlyPriceInr", "asc")),
    (snap) => cb(snap.docs.map((d) => mapPlan(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type PlanDraft = Pick<SubscriptionPlan, "name" | "monthlyPriceInr" | "discountPct">;

export async function createPlan(draft: PlanDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), SUBSCRIPTION_PLANS), {
    ...draft, active: true, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function updatePlan(id: string, draft: PlanDraft): Promise<void> {
  await updateDoc(doc(getDb(), SUBSCRIPTION_PLANS, id), { ...draft });
}

export async function setPlanActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), SUBSCRIPTION_PLANS, id), { active });
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), SUBSCRIPTION_PLANS, id));
}

export function subscribeUserSubscription(
  emspUserId: string,
  cb: (row: UserSubscription | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), USER_SUBSCRIPTIONS),
      where("emspUserId", "==", emspUserId),
      where("status", "==", "ACTIVE"),
    ),
    (snap) => cb(snap.empty ? null : mapSub(snap.docs[0]!.id, snap.docs[0]!.data())),
    (err) => onError?.(err as Error),
  );
}

export function subscribeAllSubscriptions(
  cb: (rows: UserSubscription[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), USER_SUBSCRIPTIONS), orderBy("startedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapSub(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/**
 * Subscribes a user to a plan: debits the first month up front (allowed to
 * go negative, same as a session — this is staff-initiated on the user's
 * behalf, not a self-service checkout, so there's no card decline point).
 */
export async function subscribeUserToPlan(
  emspUserId: string,
  plan: SubscriptionPlan,
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const userSnap = await getDoc(doc(db, EMSP_USERS, emspUserId));
  if (!userSnap.exists()) throw new Error("User not found.");
  const user = userSnap.data() as Omit<EmspUser, "id">;

  const now = new Date();
  const renewsAt = new Date(now);
  renewsAt.setDate(renewsAt.getDate() + 30);

  const current = user.walletBalanceInr ?? 0;
  await updateDoc(doc(db, EMSP_USERS, emspUserId), { walletBalanceInr: current - plan.monthlyPriceInr });
  await addDoc(collection(db, WALLET_TRANSACTIONS), {
    ownerType: "EMSP_USER",
    ownerId: emspUserId,
    emspUserId,
    amountInr: plan.monthlyPriceInr,
    type: "DEBIT",
    note: `Subscription: ${plan.name}`,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  await addDoc(collection(db, USER_SUBSCRIPTIONS), {
    emspUserId,
    emspUserName: user.name,
    planId: plan.id,
    planName: plan.name,
    monthlyPriceInr: plan.monthlyPriceInr,
    discountPct: plan.discountPct,
    status: "ACTIVE",
    startedAt: serverTimestamp(),
    renewsAt,
    createdBy: actor,
  });
}

export async function cancelSubscription(id: string): Promise<void> {
  await updateDoc(doc(getDb(), USER_SUBSCRIPTIONS, id), { status: "CANCELLED", cancelledAt: serverTimestamp() });
}
