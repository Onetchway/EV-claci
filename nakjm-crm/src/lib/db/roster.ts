"use client";

import {
  collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where,
} from "firebase/firestore";

import { WEEK_DAYS, type WeekDay } from "../constants";
import { defaultWeekDays } from "../dates";
import { getDb } from "../firebase/client";
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
  await setDoc(
    doc(getDb(), ROSTERS, rosterId(uid, weekStart)),
    {
      uid, userName, weekStart, days,
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
  return onSnapshot(
    query(collection(getDb(), ROSTERS), where("weekStart", "==", weekStart)),
    (snap) => cb(snap.docs.map((d) => mapRoster(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function getRostersForWeeks(weekStarts: string[]): Promise<RosterWeek[]> {
  if (weekStarts.length === 0) return [];
  const snap = await getDocs(query(collection(getDb(), ROSTERS), where("weekStart", "in", weekStarts)));
  return snap.docs.map((d) => mapRoster(d.id, d.data()));
}

export { WEEK_DAYS };
