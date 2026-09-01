"use client";

import {
  collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where,
} from "firebase/firestore";

import { WEEK_DAYS, type WeekDay } from "../constants";
import { defaultWeekDays } from "../dates";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, RosterWeek } from "../types";

export const ROSTERS = "rosters";

function rosterId(uid: string, weekStart: string): string {
  return `${uid}_${weekStart}`;
}

function mapRoster(id: string, data: Record<string, unknown>): RosterWeek {
  return { id, ...(data as Omit<RosterWeek, "id">) };
}

export function blankRosterWeek(uid: string, userName: string, weekStart: string): RosterWeek {
  return {
    id: rosterId(uid, weekStart),
    uid,
    userName,
    weekStart,
    days: defaultWeekDays(),
    createdAt: null,
  };
}

export async function saveRosterWeek(
  uid: string, userName: string, weekStart: string, days: Record<WeekDay, "WORKING" | "WEEK_OFF">, actor: Actor,
): Promise<void> {
  const orgId = await getCurrentTenantId();
  await setDoc(
    doc(getDb(), ROSTERS, rosterId(uid, weekStart)),
    {
      uid, userName, weekStart, days, orgId,
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

export function subscribeMyRosterWeek(
  uid: string, weekStart: string,
  cb: (row: RosterWeek | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), ROSTERS, rosterId(uid, weekStart)),
    (snap) => cb(snap.exists() ? mapRoster(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

/** Every roster entry saved for a given week — the manager's team grid. */
export function subscribeRosterForWeek(
  weekStart: string,
  cb: (rows: RosterWeek[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), ROSTERS), where("orgId", "==", orgId), where("weekStart", "==", weekStart)),
      (snap) => cb(snap.docs.map((d) => mapRoster(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

/** One-shot fetch across several weeks (a whole month's worth) for a CSV export — `in` supports up to 30 values, and a month never spans more than 6 Mondays. */
export async function getRostersForWeeks(weekStarts: string[]): Promise<RosterWeek[]> {
  if (weekStarts.length === 0) return [];
  const orgId = await getCurrentTenantId();
  const snap = await getDocs(query(collection(getDb(), ROSTERS), where("orgId", "==", orgId), where("weekStart", "in", weekStarts)));
  return snap.docs.map((d) => mapRoster(d.id, d.data()));
}

export { WEEK_DAYS };
