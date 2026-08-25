"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, Timestamp, where,
} from "firebase/firestore";

import type { Department } from "../constants";
import { getDb } from "../firebase/client";
import type { TeamMember } from "../types";
import { buildSearchTokens } from "../utils";

export const TEAM_MEMBERS = "teamMembers";

function mapMember(id: string, data: Record<string, unknown>): TeamMember {
  return { id, ...(data as Omit<TeamMember, "id">) };
}

export interface TeamMemberFilters {
  active?: boolean;
  department?: Department;
  search?: string;
}

export function applyTeamFilters(rows: TeamMember[], f: TeamMemberFilters): TeamMember[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((m) => {
    if (f.active !== undefined && m.active !== f.active) return false;
    if (f.department && m.department !== f.department) return false;
    if (needle) {
      const hay = [m.name, m.email, m.phone, m.designation].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle) && !(m.search ?? []).some((t) => t.startsWith(needle))) return false;
    }
    return true;
  });
}

export function subscribeTeamMembers(
  filters: TeamMemberFilters,
  cb: (rows: TeamMember[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), TEAM_MEMBERS), orderBy("name", "asc")),
    (snap) => cb(applyTeamFilters(snap.docs.map((d) => mapMember(d.id, d.data())), filters)),
    (err) => onError?.(err as Error),
  );
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const snap = await getDoc(doc(getDb(), TEAM_MEMBERS, id));
  return snap.exists() ? mapMember(snap.id, snap.data()) : null;
}

export async function listActiveTeamMembers(): Promise<TeamMember[]> {
  const snap = await getDocs(query(collection(getDb(), TEAM_MEMBERS), where("active", "==", true)));
  return snap.docs.map((d) => mapMember(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export interface TeamMemberDraft {
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department: Department;
  joinedDate?: Date | null;
}

export async function createTeamMember(draft: TeamMemberDraft): Promise<TeamMember> {
  const db = getDb();
  const ref = doc(collection(db, TEAM_MEMBERS));
  const payload = {
    ...draft,
    joinedDate: draft.joinedDate ? Timestamp.fromDate(draft.joinedDate) : null,
    active: true,
    search: buildSearchTokens(draft.name, draft.email, draft.phone, draft.designation),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...(payload as unknown as Omit<TeamMember, "id">) };
}

export async function updateTeamMember(
  id: string,
  patch: Partial<Omit<TeamMemberDraft, "joinedDate">> & { joinedDate?: Date | null; active?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.joinedDate !== undefined) update.joinedDate = patch.joinedDate ? Timestamp.fromDate(patch.joinedDate) : null;
  if (patch.name || patch.email || patch.phone || patch.designation) {
    const existing = await getTeamMember(id);
    update.search = buildSearchTokens(
      patch.name ?? existing?.name,
      patch.email ?? existing?.email,
      patch.phone ?? existing?.phone,
      patch.designation ?? existing?.designation,
    );
  }
  await updateDoc(doc(getDb(), TEAM_MEMBERS, id), update);
}
